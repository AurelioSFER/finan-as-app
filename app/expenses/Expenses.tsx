"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ACCOUNTS, FLAGS, isGoalCategory, type Expense } from "@/lib/categories";
import { merchantKey } from "@/lib/merchantKey";
import CategorySelect from "@/components/CategorySelect";

function eur2(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function monthOf(d: string) {
  return d.slice(0, 7);
}

export default function Expenses({
  initial,
  space,
  goals,
}: {
  initial: Expense[];
  space: string;
  /** Nomes dos objetivos ativos — aparecem no seletor de categoria. */
  goals: string[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Expense[]>(initial);
  const [error, setError] = useState<string | null>(null);

  const [fMonth, setFMonth] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [fText, setFText] = useState("");

  const spaceRows = useMemo(
    () => rows.filter((r) => (space === "conjunta" ? r.account === "Conjunta" : r.account !== "Conjunta")),
    [rows, space]
  );

  const months = useMemo(() => {
    const set = new Set(spaceRows.map((r) => monthOf(r.date)));
    return Array.from(set).sort().reverse();
  }, [spaceRows]);

  const filtered = useMemo(() => {
    return spaceRows.filter((r) => {
      if (fMonth !== "all" && monthOf(r.date) !== fMonth) return false;
      if (fCat !== "all" && r.category !== fCat) return false;
      if (fText && !`${r.description} ${r.notes ?? ""}`.toLowerCase().includes(fText.toLowerCase())) return false;
      return true;
    });
  }, [spaceRows, fMonth, fCat, fText]);

  /**
   * Grava uma alteração num movimento já guardado. Mostra já na lista e
   * repõe se a gravação falhar — sem isto, o ecrã dizia uma coisa e a base
   * de dados outra, e só se descobria no mês seguinte.
   */
  async function patch(row: Expense, campos: Partial<Expense>) {
    const antes = rows;
    setError(null);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...campos } : r)));
    const { error } = await supabase.from("expenses").update(campos).eq("id", row.id);
    if (error) {
      setError(error.message);
      setRows(antes);
      return false;
    }
    return true;
  }

  async function changeFlag(row: Expense, flag: string) {
    await patch(row, { flag: flag || null });
  }

  async function changeDestino(row: Expense, destino: string) {
    await patch(row, { to_account: destino || null });
  }

  async function changeCategory(row: Expense, category: string) {
    if (!(await patch(row, { category }))) return;
    // Objetivos não se aprendem: a meta fecha-se um dia e a regra ficaria a
    // mandar movimentos para um objetivo que já não existe.
    if (category !== "Outros" && !isGoalCategory(category)) {
      await supabase.from("merchant_rules").upsert({ key: merchantKey(row.description), category }, { onConflict: "key" });
    }
  }

  async function remove(id: string) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setRows(prev);
    }
  }

  return (
    <>
      <Link className="btn btn-primary" href="/import" style={{ marginBottom: 18 }}>
        📥 Importar extrato do banco
      </Link>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Filtros */}
      <div className="filters">
        <select className="select f-month" aria-label="Mês" value={fMonth} onChange={(e) => setFMonth(e.target.value)}>
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <CategorySelect
          className="select f-cat"
          value={fCat}
          onChange={setFCat}
          goals={goals}
          includeAll
        />
        <input className="input f-search" placeholder="Procurar…" aria-label="Procurar" value={fText} onChange={(e) => setFText(e.target.value)} />
      </div>

      {/* Lista — tabela no PC, cartões no telemóvel */}
      <div className="card tbl-wrap tbl-cards cards-mov">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Destino</th>
              <th>Flag</th>
              <th className="n">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="muted td-empty" style={{ textAlign: "center", padding: 28 }}>
                  Sem movimentos. Importa o extrato do banco. 👆
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="num td-date">{r.date.slice(8, 10)}/{r.date.slice(5, 7)}</td>
                <td className="td-desc">
                  {r.description}
                  {r.flag === "R" && <span className="badge R" style={{ marginLeft: 6 }}>R</span>}
                  {r.flag === "P" && <span className="badge P" style={{ marginLeft: 6 }}>P</span>}
                </td>
                <td className="td-cat">
                  {r.to_account ? (
                    <span className="muted" style={{ fontSize: 13 }}>transferência</span>
                  ) : (
                    <CategorySelect value={r.category} onChange={(v) => changeCategory(r, v)} goals={goals} />
                  )}
                </td>
                <td className="td-dest">
                  <select
                    className="select sel-dest"
                    aria-label="Conta de destino (transferência)"
                    title="Conta para onde o dinheiro foi. Em branco, o movimento conta como gasto."
                    value={r.to_account ?? ""}
                    onChange={(e) => changeDestino(r, e.target.value)}
                  >
                    <option value="">—</option>
                    {ACCOUNTS.filter((a) => a !== r.account).map((a) => (
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
                    title={
                      r.kind === "entrada"
                        ? "Reembolso: esta entrada deixa de ser rendimento e abate ao gasto da mesma categoria."
                        : "Reembolsado: este gasto não conta. Usar só quando a devolução não entra na app."
                    }
                    value={r.flag ?? ""}
                    onChange={(e) => changeFlag(r, e.target.value)}
                  >
                    {FLAGS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={"n td-amt " + (r.kind === "entrada" ? "amount-in" : "amount-out")}>
                  {r.kind === "entrada" ? "+" : "−"}
                  {eur2(r.amount)}
                </td>
                <td className="n td-del">
                  <button className="btn btn-ghost" title="Apagar" aria-label="Apagar movimento" onClick={() => remove(r.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
