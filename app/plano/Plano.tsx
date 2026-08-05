"use client";

import { Fragment, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { catColor, catIcon, typeOf, type Expense } from "@/lib/categories";
import {
  extraKey,
  extraPrefix,
  hasOwnPlan,
  inheritedFrom,
  parseBudgetRows,
  planForMonth,
  planKey,
  type BudgetRow,
  type Budgets,
  type Extra,
} from "@/lib/plan";
import { medianaPorCategoria, type Sugestao } from "@/lib/planSuggest";
import Sugerir from "./Sugerir";

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

/** Uma categoria por trás de uma rubrica do Plano. */
type Detalhe = {
  category: string;
  /** Já lançado no mês escolhido (ou média/mês, na vista "Média por mês"). */
  real: number;
  /** Quantos movimentos deram esse valor. */
  n: number;
  /** O que costuma sair nesta categoria por mês (mediana dos meses anteriores). */
  habitual: number;
};

/** O que está por trás de uma linha do Plano: categoria a categoria. */
function DetalheRubrica({
  itens,
  extras,
  planeado,
  temHistorico,
  label,
  mesLabel,
}: {
  itens: Detalhe[];
  extras: Extra[];
  planeado: number;
  temHistorico: boolean;
  label: string;
  mesLabel: string;
}) {
  if (itens.length === 0 && extras.length === 0) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Nada em {label} em {mesLabel}, e também não há histórico. Assim que classificares movimentos nestas
        categorias, aparecem aqui.
      </p>
    );
  }

  const maior = Math.max(...itens.map((i) => Math.max(i.real, i.habitual)), 1);
  const somaReal = itens.reduce((a, i) => a + i.real, 0);
  const somaHabitual = itens.reduce((a, i) => a + i.habitual, 0);

  return (
    <div className={"det" + (temHistorico ? " det-hist" : "")}>
      <div className="det-head">
        <span>Categoria</span>
        {temHistorico && <span className="n">Habitual</span>}
        <span className="n">{mesLabel}</span>
      </div>

      {itens.map((i) => (
        <div key={i.category} className="det-row">
          <span className="det-name">
            <span className="det-ic" style={{ background: catColor(i.category) + "22", color: catColor(i.category) }}>
              {catIcon(i.category)}
            </span>
            <span className="det-txt">
              {i.category}
              <small>
                {i.n > 0 ? `${i.n} ${i.n === 1 ? "movimento" : "movimentos"}` : "ainda sem movimentos este mês"}
              </small>
            </span>
          </span>
          {temHistorico && (
            <span className="n num det-hab">{i.habitual > 0 ? eur(i.habitual) : "—"}</span>
          )}
          <span className="n num det-real">{eur(i.real)}</span>
          <span
            className="det-bar"
            style={{ width: `${Math.round((i.real / maior) * 100)}%`, background: catColor(i.category) }}
          />
        </div>
      ))}

      <div className="det-row det-sum">
        <span className="det-name">Soma</span>
        {temHistorico && <span className="n num det-hab">{eur(somaHabitual)}</span>}
        <span className="n num det-real">{eur(somaReal)}</span>
      </div>

      {/* Os extras são previsões, não gastos — ficam fora do quadro do real. */}
      {extras.length > 0 && (
        <div className="det-extras">
          <div className="det-extras-h">+ despesas fora do normal, contadas no planeado</div>
          {extras.map((e, i) => (
            <div key={i} className="det-extras-row">
              <span>✨ {e.label}</span>
              <span className="num">{eur(e.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="muted" style={{ margin: "10px 2px 0", fontSize: 12.5 }}>
        {temHistorico ? (
          <>
            Planeaste <b>{eur(planeado)}</b>. <b>Habitual</b> é a mediana dos meses anteriores — foi daí que saiu o
            plano{extras.length > 0 && <>, mais as despesas extra acima</>}.
          </>
        ) : (
          <>Planeaste {eur(planeado)} para esta rubrica.</>
        )}
      </p>
    </div>
  );
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

export default function Plano({
  rows,
  budgetRows,
  space,
  today,
}: {
  rows: Expense[];
  budgetRows: BudgetRow[];
  space: string;
  /** Mês corrente vindo do servidor, para o cliente não divergir no primeiro render. */
  today: string;
}) {
  const supabase = createClient();
  const spaceRows = useMemo(
    () => rows.filter((r) => (space === "conjunta" ? r.account === "Conjunta" : r.account !== "Conjunta")),
    [rows, space]
  );

  const parsed = useMemo(() => parseBudgetRows(budgetRows, space), [budgetRows, space]);

  // O mês corrente entra sempre na lista: dá para planear Agosto mal o extrato chegue.
  const months = useMemo(() => {
    const set = new Set(spaceRows.map((r) => monthOf(r.date)));
    set.add(today);
    Object.keys(parsed.porMes).forEach((m) => set.add(m));
    return Array.from(set).sort().reverse();
  }, [spaceRows, parsed, today]);

  const [month, setMonth] = useState<string>(months[0] ?? "all");
  const [overrides, setOverrides] = useState<Record<string, Budgets>>({});
  const [extrasByMonth, setExtrasByMonth] = useState<Record<string, Extra[]>>(parsed.extras);
  const [wizard, setWizard] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planned = useMemo<Budgets>(
    () => ({ ...planForMonth(space, month, parsed), ...(overrides[month] ?? {}) }),
    [space, month, parsed, overrides]
  );
  const extras = extrasByMonth[month] ?? [];
  const proprio = hasOwnPlan(month, parsed) || !!overrides[month];
  const herdadoDe = proprio ? null : inheritedFrom(month, parsed);

  const inMonth = useMemo(
    () => (month === "all" ? spaceRows : spaceRows.filter((r) => monthOf(r.date) === month)),
    [spaceRows, month]
  );
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

  // ---- Abrir uma rubrica para ver de que é que ela é feita ----
  const habitual = useMemo(
    () => (month === "all" ? {} : medianaPorCategoria(spaceRows, month)),
    [spaceRows, month]
  );

  /** As categorias por trás de uma linha do Plano: o que já saiu e o que costuma sair. */
  function detalheDe(key: string): Detalhe[] {
    const doMes =
      key === "rendimento"
        ? inMonth.filter((r) => r.kind === "entrada")
        : inMonth.filter((r) => r.kind === "gasto" && r.flag !== "R" && typeOf(r.category) === key);

    const acc = new Map<string, { real: number; n: number }>();
    for (const r of doMes) {
      const a = acc.get(r.category) ?? { real: 0, n: 0 };
      acc.set(r.category, { real: a.real + r.amount, n: a.n + 1 });
    }

    // categorias habituais desta rubrica entram mesmo sem movimentos este mês:
    // é isso que responde a "quais são os meus gastos fixos?"
    const rubricaDe = (c: string) => (key === "rendimento" ? typeOf(c) === "Rendimento" : typeOf(c) === key);
    const cats = new Set(acc.keys());
    for (const [c, med] of Object.entries(habitual)) if (med > 0 && rubricaDe(c)) cats.add(c);

    return Array.from(cats)
      .map((c) => ({
        category: c,
        real: (acc.get(c)?.real ?? 0) / nMonths,
        n: acc.get(c)?.n ?? 0,
        habitual: habitual[c] ?? 0,
      }))
      .sort((a, b) => b.real - a.real || b.habitual - a.habitual);
  }

  function onPlanned(key: string, v: string) {
    setOverrides((o) => ({ ...o, [month]: { ...(o[month] ?? {}), [key]: parseNum(v) } }));
  }
  async function savePlanned(key: string) {
    const { error } = await supabase
      .from("budgets")
      .upsert(
        { key: planKey(space, month, key), planned: planned[key] ?? 0, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) setError(error.message);
  }

  async function aplicarSugestao(s: Sugestao, novosExtras: Extra[]) {
    setError(null);
    const when = new Date().toISOString();
    const linhas = Object.entries(s).map(([k, v]) => ({
      key: planKey(space, month, k),
      planned: v,
      updated_at: when,
    }));
    const { error: upErr } = await supabase.from("budgets").upsert(linhas, { onConflict: "key" });
    if (upErr) {
      setError(upErr.message);
      return;
    }
    // os extras do mês são substituídos por inteiro
    await supabase.from("budgets").delete().like("key", extraPrefix(space, month) + "%");
    if (novosExtras.length) {
      const { error: exErr } = await supabase.from("budgets").insert(
        novosExtras.map((e) => ({ key: extraKey(space, month, e), planned: e.amount, updated_at: when }))
      );
      if (exErr) setError(exErr.message);
    }
    setOverrides((o) => ({ ...o, [month]: { ...s } }));
    setExtrasByMonth((x) => ({ ...x, [month]: novosExtras }));
    setWizard(false);
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

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {month !== "all" && !wizard && (
        <button className="btn btn-primary" style={{ marginBottom: 14 }} onClick={() => setWizard(true)}>
          ✨ {proprio ? "Refazer" : "Sugerir"} plano para {monthLabel(month)}
        </button>
      )}

      {month !== "all" && wizard && (
        <Sugerir
          rows={spaceRows}
          month={month}
          label={monthLabel(month)}
          extrasIniciais={extras}
          onApply={aplicarSugestao}
          onClose={() => setWizard(false)}
        />
      )}

      {herdadoDe && (
        <div className="notice" style={{ marginBottom: 14 }}>
          {monthLabel(month)} ainda não tem plano próprio — está a usar o de {monthLabel(herdadoDe)}. Gera um novo ou
          escreve por cima dos valores.
        </div>
      )}

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
              const open = aberta === r.key;
              return (
                <Fragment key={r.key}>
                  <tr className={open ? "row-open" : undefined}>
                    <td className="td-name">
                      <button
                        type="button"
                        className="det-toggle"
                        aria-expanded={open}
                        onClick={() => setAberta(open ? null : r.key)}
                      >
                        <span className={"det-chev" + (open ? " is-open" : "")}>›</span>
                        <span className="sec-ic">{r.icon}</span> {r.label}
                      </button>
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
                  {open && (
                    <tr className="row-detail">
                      <td colSpan={4}>
                        <DetalheRubrica
                          itens={detalheDe(r.key)}
                          extras={r.role === "out" ? extras.filter((e) => e.rubrica === r.key) : []}
                          planeado={plan}
                          temHistorico={Object.keys(habitual).length > 0}
                          label={r.label}
                          mesLabel={monthLabel(month)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
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

      {extras.length > 0 && (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
            Despesas fora do normal já incluídas neste plano
          </div>
          {extras.map((e, i) => (
            <div key={i} className="cat-row" style={{ padding: "7px 0" }}>
              <span className="name">
                {e.label}
                <span className="muted" style={{ fontSize: 12 }}> · em {e.rubrica}</span>
              </span>
              <span className="amt num">{eur(e.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 50 / 30 / 20 */}
      <div className="section-title">Equilíbrio · regra 50/30/20 · {monthLabel(month)}</div>
      <div className="card" style={{ padding: 18 }}>
        <Bar icon="🧱" label="Precisas (Fixos + Necessários)" pct={pct(needs)} target={50} color="var(--accent-2)" />
        <Bar icon="🎈" label="Queres (Supérfluos)" pct={pct(wants)} target={30} color="#ff6b9d" />
        <Bar icon="💰" label="Poupança / Investir" pct={pct(save)} target={20} color="var(--good)" />
        <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
          Base de cálculo: rendimento de {eur(rend)}. A linha cinzenta marca a meta.
        </p>
      </div>
    </>
  );
}
