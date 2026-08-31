"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNTS, FLAGS, isGoalCategory } from "@/lib/categories";
import CategorySelect from "@/components/CategorySelect";
import { parseStatement, type ParsedRow } from "@/lib/parseStatement";
import { type Espaco } from "@/lib/transfers";
import { merchantKey } from "@/lib/merchantKey";
import { autoCategory } from "@/lib/autoCategory";

type Draft = ParsedRow & {
  key: string;
  category: string;
  flag: string;
  /** Conta de destino. "" = não é transferência, conta como gasto normal. */
  destino: string;
  include: boolean;
};

function eur2(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * O `R` faz coisas diferentes conforme o dinheiro entra ou sai, e marcar os
 * dois lados da mesma história dá gastos negativos. A explicação vai no
 * tooltip e não no rótulo: a largura do `<select>` é a da opção mais comprida,
 * e um rótulo explicativo empurrava a coluna toda para fora do cartão.
 */
function dicaReembolso(kind: "gasto" | "entrada"): string {
  return kind === "entrada"
    ? "Reembolso: esta entrada deixa de ser rendimento e abate ao gasto da mesma categoria."
    : "Reembolsado: este gasto não conta. Usar só quando a devolução não entra na app.";
}

export default function Import({
  rules,
  defaultAccount,
  space,
  goals,
}: {
  rules: Record<string, string>;
  defaultAccount: string;
  /** Qual das duas contabilidades está a receber o extrato. */
  space: Espaco;
  /** Nomes dos objetivos ativos — aparecem no seletor de categoria. */
  goals: string[];
}) {
  const supabase = createClient();
  const [raw, setRaw] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [account, setAccount] = useState<string>(defaultAccount);
  const [format, setFormat] = useState<string>("");
  const [skipped, setSkipped] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [lendoImagem, setLendoImagem] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw(text);
      analisar(text);
    };
    reader.onerror = () => setError("Não consegui ler o ficheiro.");
    reader.readAsText(file);
    e.target.value = "";
  }

  /**
   * Um print não tem formato fixo como um CSV: a leitura é feita no servidor
   * (a chave da API não pode viver no browser) e o resultado cai na mesma
   * tabela de revisão, para confirmares antes de gravar.
   */
  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setSavedCount(null);
    setAvisos([]);
    setLendoImagem(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Não consegui ler o ficheiro."));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/extrato-imagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mediaType: file.type,
          ano: new Date().getFullYear(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não consegui ler a imagem.");
        return;
      }

      const rows: ParsedRow[] = (data.movimentos ?? []).map((m: any) => ({
        date: m.date,
        description: m.description,
        amount: m.amount,
        kind: m.kind,
        isTransfer: false,
        toAccount: null,
      }));

      if (rows.length === 0) {
        setError("Não encontrei movimentos nesta imagem.");
        setAvisos(data.avisos ?? []);
        return;
      }

      montarDrafts(rows, "Imagem");
      const av = [...(data.avisos ?? [])];
      if (data.descartados > 0) av.push(`${data.descartados} linha(s) vieram incompletas e ficaram de fora.`);
      setAvisos(av);
    } catch {
      setError("Não consegui ler a imagem.");
    } finally {
      setLendoImagem(false);
    }
  }

  /** Transforma movimentos lidos (de texto ou de imagem) em linhas para rever. */
  function montarDrafts(rows: ParsedRow[], formato: string) {
    // Quando o extrato diz que houve transferência mas não diz para onde, o
    // palpite é a outra conta principal — corriges na coluna Destino.
    const palpite = formato === "Revolut" ? "Caixa" : "Revolut";

    const d: Draft[] = rows.map((r) => {
      const key = merchantKey(r.description);
      return {
        ...r,
        key,
        // 1º a memória aprendida, 2º o cérebro embutido, senão "Outros"
        category: rules[key] ?? autoCategory(r.description) ?? "Outros",
        flag: "",
        destino: r.isTransfer ? r.toAccount ?? palpite : "",
        include: true,
      };
    });
    setDrafts(d);
    setFormat(formato);
  }

  function analisar(text: string = raw) {
    setError(null);
    setSavedCount(null);
    const { rows, format, skipped } = parseStatement(text, space);
    if (rows.length === 0) {
      setError("Não consegui ler movimentos. Confirma que colaste o extrato da Caixa ou da Revolut.");
      return;
    }
    montarDrafts(rows, format);
    setSkipped(skipped);
    setAvisos([]);
    if (defaultAccount !== "Conjunta") setAccount(format === "Revolut" ? "Revolut" : "Caixa");
  }

  function upd(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  }

  async function guardar() {
    if (!drafts) return;
    setSaving(true);
    setError(null);
    const chosen = drafts.filter((d) => d.include);
    const payload = chosen.map((d) => ({
      date: d.date,
      description: d.description,
      amount: d.amount,
      kind: d.kind,
      category: d.category,
      account,
      to_account: d.destino || null,
      flag: d.flag || null,
      notes: null as string | null,
    }));

    const { error: insErr } = await supabase.from("expenses").insert(payload);
    if (insErr) {
      setError(insErr.message);
      setSaving(false);
      return;
    }

    // Ensinar a memória: chave -> categoria (dedupe, última vence). Ignora "Outros".
    const ruleMap = new Map<string, string>();
    chosen.forEach((d) => {
      // transferências ficam de fora: não há comerciante para aprender
      if (d.destino) return;
      // objetivos ficam de fora: a meta fecha-se e a regra ficaria órfã
      if (d.category && d.category !== "Outros" && !isGoalCategory(d.category)) ruleMap.set(d.key, d.category);
    });
    if (ruleMap.size > 0) {
      try {
        const ruleRows = Array.from(ruleMap.entries()).map(([key, category]) => ({ key, category }));
        await supabase.from("merchant_rules").upsert(ruleRows, { onConflict: "key" });
      } catch {
        // a memória é opcional — nunca bloqueia o guardar
      }
    }

    setSaving(false);
    setSavedCount(chosen.length);
    setDrafts(null);
    setRaw("");
  }

  if (savedCount !== null) {
    return (
      <div className="card" style={{ padding: 28, textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>✅ {savedCount} movimentos guardados!</p>
        <p className="muted" style={{ margin: "0 0 18px" }}>
          A memória aprendeu as categorias que confirmaste. Agora podes montar o plano deste mês com estes números.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href="/plano">
            ✨ Fazer o plano do mês
          </Link>
          <Link className="btn" href="/dashboard">
            Ver dashboard
          </Link>
          <button className="btn" onClick={() => setSavedCount(null)}>
            Importar mais
          </button>
        </div>
      </div>
    );
  }

  if (!drafts) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <label className="uploader">
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} hidden />
          <span className="up-ic">📎</span>
          <span>
            <b>Anexar ficheiro do banco</b>
            <br />
            <span className="muted" style={{ fontSize: 12.5 }}>Excel/CSV exportado da Caixa ou da Revolut</span>
          </span>
        </label>

        <label className="uploader" style={{ marginTop: 12, opacity: lendoImagem ? 0.6 : 1 }}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onImage}
            disabled={lendoImagem}
            hidden
          />
          <span className="up-ic">{lendoImagem ? "⏳" : "📷"}</span>
          <span>
            <b>{lendoImagem ? "A ler o print…" : "Anexar print dos movimentos"}</b>
            <br />
            <span className="muted" style={{ fontSize: 12.5 }}>
              {lendoImagem
                ? "Pode demorar até meio minuto"
                : "Para contas sem exportação, como o cartão de refeição"}
            </span>
          </span>
        </label>

        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ cursor: "pointer", fontSize: 13.5 }}>
            ou colar o texto manualmente
          </summary>
          <textarea
            className="input"
            rows={7}
            style={{ fontFamily: "monospace", fontSize: 12.5, marginTop: 10 }}
            placeholder="Cola aqui o extrato…"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={() => analisar()} disabled={!raw.trim()}>
              Analisar texto
            </button>
          </div>
        </details>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  const incluidos = drafts.filter((d) => d.include).length;
  const transferencias = drafts.filter((d) => d.include && d.destino).length;

  return (
    <>
      <div className="card" style={{ padding: 14, marginBottom: 14, position: "sticky", top: 8, zIndex: 10 }}>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="badge">{format}</span>
          <span className="muted">
            {incluidos}/{drafts.length} a guardar
            {transferencias ? ` · ${transferencias} transferências` : ""}
            {skipped ? ` · ${skipped} ignorados` : ""}
          </span>
          <div className="spacer" />
          <label className="muted" style={{ margin: 0 }}>Conta:</label>
          <select className="select sel-cell" aria-label="Conta" value={account} onChange={(e) => setAccount(e.target.value)}>
            {ACCOUNTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={saving || incluidos === 0}>
            {saving ? "A guardar…" : `💾 Guardar ${incluidos} movimentos`}
          </button>
          <button className="btn" onClick={() => setDrafts(null)} disabled={saving}>
            Voltar
          </button>
        </div>
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        {avisos.length > 0 && (
          // A leitura de um print pode falhar linhas. Dizer quais, em vez de
          // deixar o utilizador descobrir que faltam movimentos semanas depois.
          <div className="notice" style={{ marginTop: 10 }}>
            <b>A leitura deixou avisos:</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card tbl-wrap tbl-cards cards-draft" style={{ marginBottom: 14 }}>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Data</th>
              <th>Descrição</th>
              <th className="n">Valor</th>
              <th>Categoria</th>
              <th>Destino</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, i) => (
              <tr key={i} style={{ opacity: d.include ? 1 : 0.4 }}>
                <td className="td-chk">
                  <input
                    type="checkbox"
                    aria-label="Incluir este movimento"
                    checked={d.include}
                    onChange={(e) => upd(i, { include: e.target.checked })}
                  />
                </td>
                <td className="num td-date">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</td>
                <td className="td-desc">{d.description}</td>
                <td className={"n td-amt " + (d.kind === "entrada" ? "amount-in" : "amount-out")}>
                  {d.kind === "entrada" ? "+" : "−"}
                  {eur2(d.amount)}
                </td>
                <td className="td-cat">
                  {d.destino ? (
                    // Uma transferência não tem categoria: o dinheiro mudou de
                    // conta, não foi consumido. Mostrar o seletor aqui só dava
                    // a entender que a escolha muda alguma coisa — não muda.
                    <span className="muted" style={{ fontSize: 13 }}>
                      transferência
                    </span>
                  ) : (
                    <CategorySelect value={d.category} onChange={(v) => upd(i, { category: v })} goals={goals} />
                  )}
                </td>
                <td className="td-dest">
                  <select
                    className="select sel-dest"
                    aria-label="Conta de destino (transferência)"
                    title="Conta para onde o dinheiro foi. Em branco, o movimento conta como gasto."
                    value={d.destino}
                    onChange={(e) => upd(i, { destino: e.target.value })}
                  >
                    <option value="">—</option>
                    {ACCOUNTS.filter((a) => a !== account).map((a) => (
                      <option key={a} value={a}>
                        ↗ {a}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="td-flag">
                  <select
                    className="select sel-flag"
                    aria-label="Marca (reembolso / prenda)"
                    title={dicaReembolso(d.kind)}
                    value={d.flag}
                    onChange={(e) => upd(i, { flag: e.target.value })}
                  >
                    {FLAGS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="toolbar">
        <button className="btn btn-primary" onClick={guardar} disabled={saving || incluidos === 0}>
          {saving ? "A guardar…" : `Guardar ${incluidos} movimentos`}
        </button>
        <button className="btn" onClick={() => setDrafts(null)} disabled={saving}>
          Voltar
        </button>
      </div>
    </>
  );
}
