"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNTS, FLAGS, isGoalCategory } from "@/lib/categories";
import CategorySelect from "@/components/CategorySelect";
import { parseStatement, type ParsedRow } from "@/lib/parseStatement";
import { merchantKey } from "@/lib/merchantKey";
import { autoCategory } from "@/lib/autoCategory";

type Draft = ParsedRow & { key: string; category: string; flag: string; include: boolean };

function eur2(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Import({
  rules,
  defaultAccount,
  goals,
}: {
  rules: Record<string, string>;
  defaultAccount: string;
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

  function analisar(text: string = raw) {
    setError(null);
    setSavedCount(null);
    const { rows, format, skipped } = parseStatement(text);
    if (rows.length === 0) {
      setError("Não consegui ler movimentos. Confirma que colaste o extrato da Caixa ou da Revolut.");
      return;
    }
    const d: Draft[] = rows.map((r) => {
      const key = merchantKey(r.description);
      return {
        ...r,
        key,
        // 1º a memória aprendida, 2º o cérebro embutido, senão "Outros"
        category: rules[key] ?? autoCategory(r.description) ?? "Outros",
        flag: "",
        include: true,
      };
    });
    setDrafts(d);
    setFormat(format);
    setSkipped(skipped);
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

  return (
    <>
      <div className="card" style={{ padding: 14, marginBottom: 14, position: "sticky", top: 8, zIndex: 10 }}>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <span className="badge">{format}</span>
          <span className="muted">
            {incluidos}/{drafts.length} a guardar{skipped ? ` · ${skipped} ignorados` : ""}
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
                  <CategorySelect value={d.category} onChange={(v) => upd(i, { category: v })} goals={goals} />
                </td>
                <td className="td-flag">
                  <select
                    className="select sel-flag"
                    aria-label="Marca (reembolsado / prenda)"
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
