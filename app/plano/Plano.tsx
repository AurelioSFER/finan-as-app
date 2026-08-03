"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { typeOf, type Expense } from "@/lib/categories";
import { seedFor, type Budgets } from "@/lib/plan";

const ROWS: { key: string; icon: string; label: string; role: "in" | "out" | "save" }[] = [
  { key: "rendimento", icon: "💵", label: "Rendimento", role: "in" },
  { key: "Fixos", icon: "🔒", label: "Fixos", role: "out" },
  { key: "Necessários", icon: "🍞", label: "Necessários", role: "out" },
  { key: "Supérfluos", icon: "🎈", label: "Supérfluos", role: "out" },
  { key: "Poupança", icon: "💰", label: "Poupar / Investir", role: "save" },
];

function eur(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function monthOf(d: string) {
  return d.slice(0, 7);
}
function monthLabel(m: string) {
  if (m === "all") return "Média por mês";
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [y, mo] = m.split("-");
  return `${names[parseInt(mo, 10) - 1]} ${y}`;
}
function parseNum(s: string) {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

function Bar({
  pct,
  target,
  icon,
  label,
  color,
}: {
  pct: number;
  target: number;
  icon: string;
  label: string;
  color: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 5 }}>
        <span style={{ fontWeight: 600 }}>
          <span className="sec-ic">{icon}</span> {label}
        </span>
        <span className="num" style={{ fontWeight: 700, color }}>
          {pct}% <span className="muted" style={{ fontWeight: 400 }}>/ meta {target}%</span>
        </span>
      </div>
      <div style={{ height: 9, borderRadius: 6, background: "var(--surface-2)", position: "relative", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 6 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, target)}%`, width: 2, background: "var(--ink-2)" }} />
      </div>
    </div>
  );
}

export default function Plano({ rows, budgets, space }: { rows: Expense[]; budgets: Budgets; space: string }) {
  const supabase = createClient();
  const SEED = seedFor(space);
  const spaceRows = useMemo(
    () => rows.filter((r) => (space === "conjunta" ? r.account === "Conjunta" : r.account !== "Conjunta")),
    [rows, space]
  );
  const months = useMemo(() => Array.from(new Set(spaceRows.map((r) => monthOf(r.date)))).sort().reverse(), [spaceRows]);
  const [month, setMonth] = useState<string>(months[0] ?? "all");
  const [planned, setPlanned] = useState<Budgets>({ ...SEED, ...budgets });

  const inMonth = useMemo(() => (month === "all" ? spaceRows : spaceRows.filter((r) => monthOf(r.date) === month)), [spaceRows, month]);
  const nMonths = month === "all" ? Math.max(1, months.length) : 1;

  function realFor(key: string): number {
    if (key === "rendimento") {
      return inMonth.filter((r) => r.kind === "entrada").reduce((a, r) => a + r.amount, 0) / nMonths;
    }
    return (
      inMonth.filter((r) => r.kind === "gasto" && r.flag !== "R" && typeOf(r.category) === key).reduce((a, r) => a + r.amount, 0) /
      nMonths
    );
  }

  function onPlanned(key: string, v: string) {
    setPlanned((p) => ({ ...p, [key]: parseNum(v) }));
  }
  async function savePlanned(key: string) {
    await supabase.from("budgets").upsert({ key: `${space}:${key}`, planned: planned[key] ?? 0, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  const rend = realFor("rendimento") || planned.rendimento;
  const needs = realFor("Fixos") + realFor("Necessários");
  const wants = realFor("Supérfluos");
  const save = realFor("Poupança");
  const pct = (n: number) => (rend > 0 ? Math.round((n / rend) * 100) : 0);

  const plannedOut = planned.Fixos + planned.Necessários + planned.Supérfluos + planned.Poupança;
  const plannedSobra = planned.rendimento - plannedOut;

  return (
    <>
      <div className="toolbar">
        <select className="select sel-month" aria-label="Mês" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">Média por mês</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <div className="spacer" />
      </div>

      {/* Planeado vs Real — tabela no PC, cartões no telemóvel */}
      <div className="card tbl-wrap tbl-cards cards-plan">
        <table>
          <thead>
            <tr>
              <th></th>
              <th className="n">🎯 Planeado</th>
              <th className="n">📊 Real</th>
              <th className="n">Δ</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const real = realFor(r.key);
              const plan = planned[r.key] ?? 0;
              const delta = real - plan;
              // cor do Δ: rendimento/poupança mais = bom; gastos mais = mau
              const good = r.role === "out" ? delta <= 0 : delta >= 0;
              return (
                <tr key={r.key}>
                  <td className="td-name" style={{ fontWeight: 600 }}>
                    <span className="sec-ic">{r.icon}</span> {r.label}
                  </td>
                  <td className="n td-plan" data-label="Planeado">
                    <input
                      className="input input-cell"
                      aria-label={`Planeado — ${r.label}`}
                      inputMode="decimal"
                      value={String(plan)}
                      onChange={(e) => onPlanned(r.key, e.target.value)}
                      onBlur={() => savePlanned(r.key)}
                    />
                  </td>
                  <td className="n num td-real" data-label="Real" style={{ fontWeight: 700 }}>{eur(real)}</td>
                  <td
                    className="n num td-delta"
                    data-label="Δ"
                    style={{ fontWeight: 700, color: good ? "var(--good)" : "var(--bad)" }}
                  >
                    {delta >= 0 ? "+" : "−"}
                    {eur(Math.abs(delta))}
                  </td>
                </tr>
              );
            })}
            <tr className="row-total" style={{ background: "var(--surface-2)" }}>
              <td className="td-name" style={{ fontWeight: 800 }}>= Sobra planeada</td>
              <td className="n num td-plan" style={{ fontWeight: 800, color: plannedSobra >= 0 ? "var(--good)" : "var(--bad)" }}>
                {plannedSobra >= 0 ? "+" : "−"}
                {eur(Math.abs(plannedSobra))}
              </td>
              <td className="td-void" colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 50 / 30 / 20 */}
      <div className="section-title">Equilíbrio · regra 50/30/20 · {monthLabel(month)}</div>
      <div className="card" style={{ padding: 18 }}>
        <Bar icon="🧱" label="Precisas (Fixos + Necessários)" pct={pct(needs)} target={50} color="var(--accent-2)" />
        <Bar icon="🎈" label="Queres (Supérfluos)" pct={pct(wants)} target={30} color="#ff6b9d" />
        <Bar icon="💰" label="Poupança / Investir" pct={pct(save)} target={20} color="var(--good)" />
        <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
          Base de cálculo: rendimento de {eur(rend)}. A linha cinzenta marca a meta. Ajusta o Planeado à tua realidade
          quando receberes o salário do mês.
        </p>
      </div>
    </>
  );
}
