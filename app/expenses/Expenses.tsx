"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, type Expense } from "@/lib/categories";
import { merchantKey } from "@/lib/merchantKey";

function eur2(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function monthOf(d: string) {
  return d.slice(0, 7);
}

export default function Expenses({ initial, space }: { initial: Expense[]; space: string }) {
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

  async function changeCategory(row: Expense, category: string) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, category } : r)));
    await supabase.from("expenses").update({ category }).eq("id", row.id);
    if (category !== "Outros") {
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
        <select className="select f-cat" aria-label="Categoria" value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="all">Todas as categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
              <th className="n">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="muted td-empty" style={{ textAlign: "center", padding: 28 }}>
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
                  <select
                    className="select sel-cell"
                    aria-label="Categoria"
                    value={r.category}
                    onChange={(e) => changeCategory(r, e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
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
