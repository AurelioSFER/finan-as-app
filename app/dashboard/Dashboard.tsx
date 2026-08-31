"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  catColor,
  catIcon,
  typeOf,
  isSavings,
  contaComoGasto,
  contaComoEntrada,
  pesoNoGasto,
  categoriaEfetiva,
  type Expense,
} from "@/lib/categories";
import {
  CHART_IN,
  CHART_OUT,
  CHART_SAVE,
  TYPE_CHART_COLORS,
  TYPE_ORDER,
  GRID,
  AXIS_INK,
  tooltipStyle,
} from "@/lib/chartTheme";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CAT_LIMIT = 8;

function eur(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function eur2(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function eurAxis(n: number) {
  if (Math.abs(n) >= 1000) return "€" + (n / 1000).toFixed(1).replace(".", ",") + "k";
  return "€" + Math.round(n);
}
function monthOf(d: string) {
  return d.slice(0, 7);
}
function monthLabel(m: string) {
  if (m === "all") return "Sempre";
  const [y, mo] = m.split("-");
  return `${MESES[parseInt(mo, 10) - 1]} ${y}`;
}
function monthShort(m: string) {
  const [, mo] = m.split("-");
  return MESES[parseInt(mo, 10) - 1];
}
function daysElapsed(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const now = new Date();
  if (now.getFullYear() === y && now.getMonth() + 1 === mo) return now.getDate();
  return new Date(y, mo, 0).getDate();
}

/** Variação % entre dois valores; null quando não há base de comparação. */
function delta(cur: number, prev: number | undefined): number | null {
  if (prev === undefined || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Chip de variação: seta + % (a seta é o encoding, a cor só reforça). */
function Delta({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null) return <span className="muted" style={{ fontSize: 11.5 }}>sem mês anterior</span>;
  const up = value >= 0;
  const good = up === goodWhenUp;
  return (
    <span
      className="num"
      style={{ fontSize: 11.5, fontWeight: 700, color: good ? "var(--good)" : "var(--bad)" }}
      title="vs mês anterior"
    >
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(0)}% <span className="muted" style={{ fontWeight: 400 }}>vs mês ant.</span>
    </span>
  );
}

/** Variação em euros. Para o saldo a % não serve: a base anda perto de zero. */
function DeltaAbs({ cur, prev }: { cur: number; prev: number | undefined }) {
  if (prev === undefined) return <span className="muted" style={{ fontSize: 11.5 }}>sem mês anterior</span>;
  const d = cur - prev;
  const up = d >= 0;
  return (
    <span className="num" style={{ fontSize: 11.5, fontWeight: 700, color: up ? "var(--good)" : "var(--bad)" }}>
      {up ? "▲ +" : "▼ −"}
      {eur(Math.abs(d))} <span className="muted" style={{ fontWeight: 400 }}>vs mês ant.</span>
    </span>
  );
}

type Agg = { in: number; out: number; save: number; inv: number };

export default function Dashboard({ rows, space }: { rows: Expense[]; space: string }) {
  const spaceRows = useMemo(
    () => rows.filter((r) => (space === "conjunta" ? r.account === "Conjunta" : r.account !== "Conjunta")),
    [rows, space]
  );

  const months = useMemo(() => {
    const set = new Set(spaceRows.map((r) => monthOf(r.date)));
    return Array.from(set).sort().reverse();
  }, [spaceRows]);

  const [month, setMonth] = useState<string>(months[0] ?? "all");
  const [allCats, setAllCats] = useState(false);

  const inMonth = useMemo(
    () => (month === "all" ? spaceRows : spaceRows.filter((r) => monthOf(r.date) === month)),
    [spaceRows, month]
  );

  // ---- Agregado por mês (entradas / gastos reais / poupado)
  const aggByMonth = useMemo(() => {
    const map = new Map<string, Agg>();
    for (const r of spaceRows) {
      const m = monthOf(r.date);
      const a = map.get(m) ?? { in: 0, out: 0, save: 0, inv: 0 };
      if (contaComoEntrada(r)) a.in += r.amount;
      else {
        // negativo quando é dinheiro a voltar — abate ao gasto, não é rendimento
        const p = pesoNoGasto(r);
        const cat = categoriaEfetiva(r);
        if (cat === "Investimento") a.inv += p;
        else if (isSavings(cat)) a.save += p;
        else a.out += p;
      }
      map.set(m, a);
    }
    return map;
  }, [spaceRows]);

  const monthsAsc = useMemo(() => [...months].reverse(), [months]);
  const prevMonth = useMemo(() => {
    if (month === "all") return undefined;
    const i = monthsAsc.indexOf(month);
    return i > 0 ? monthsAsc[i - 1] : undefined;
  }, [monthsAsc, month]);

  const entradas = inMonth.filter(contaComoEntrada).reduce((a, r) => a + r.amount, 0);
  const gastosReais = inMonth.reduce((a, r) => a + (isSavings(categoriaEfetiva(r)) ? 0 : pesoNoGasto(r)), 0);
  const poupado = inMonth.reduce(
    (a, r) => a + (categoriaEfetiva(r) !== "Investimento" && isSavings(categoriaEfetiva(r)) ? pesoNoGasto(r) : 0),
    0
  );
  const investido = inMonth.reduce((a, r) => a + (categoriaEfetiva(r) === "Investimento" ? pesoNoGasto(r) : 0), 0);
  const saldo = entradas - gastosReais - poupado - investido;

  const prevAgg = prevMonth ? aggByMonth.get(prevMonth) : undefined;
  const prevSaldo = prevAgg ? prevAgg.in - prevAgg.out - prevAgg.save - prevAgg.inv : undefined;

  // ---- Série dos últimos 12 meses (a terminar no mês selecionado)
  const series = useMemo(() => {
    const end = month === "all" ? monthsAsc.length : monthsAsc.indexOf(month) + 1;
    const win = monthsAsc.slice(Math.max(0, end - 12), end);
    return win.map((m) => {
      const a = aggByMonth.get(m) ?? { in: 0, out: 0, save: 0, inv: 0 };
      return { m, label: monthShort(m), rendimento: Math.round(a.in), gastos: Math.round(a.out) };
    });
  }, [monthsAsc, month, aggByMonth]);

  // ---- Por categoria (gastos reais)
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of inMonth) {
      const cat = categoriaEfetiva(r);
      if (isSavings(cat)) continue;
      const p = pesoNoGasto(r);
      if (p === 0) continue;
      map.set(cat, (map.get(cat) ?? 0) + p);
    }
    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value: Math.round(value * 100) / 100 }))
      // uma categoria totalmente reembolsada fica a zero — não vale a pena mostrá-la
      .filter((r) => r.value !== 0)
      .sort((a, b) => b.value - a.value);
  }, [inMonth]);

  const donut = useMemo(() => {
    if (byCategory.length <= 8) return byCategory;
    const top = byCategory.slice(0, 7);
    const rest = byCategory.slice(7).reduce((a, r) => a + r.value, 0);
    return [...top, { category: "Outros", value: Math.round(rest * 100) / 100 }];
  }, [byCategory]);

  // ---- Para onde vai o dinheiro (tipos de gasto)
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of inMonth) {
      const p = pesoNoGasto(r);
      if (p === 0) continue;
      const t = typeOf(categoriaEfetiva(r));
      map.set(t, (map.get(t) ?? 0) + p);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    const list = TYPE_ORDER.filter((t) => (map.get(t) ?? 0) > 0).map((t) => ({
      type: t,
      value: map.get(t)!,
      pct: total > 0 ? (map.get(t)! / total) * 100 : 0,
    }));
    return { list, total };
  }, [inMonth]);

  // ---- Variações por categoria vs mês anterior
  const variacoes = useMemo(() => {
    if (!prevMonth) return [];
    const sum = (m: string) => {
      const map = new Map<string, number>();
      for (const r of spaceRows) {
        const cat = categoriaEfetiva(r);
        if (monthOf(r.date) !== m || isSavings(cat)) continue;
        const p = pesoNoGasto(r);
        if (p !== 0) map.set(cat, (map.get(cat) ?? 0) + p);
      }
      return map;
    };
    const cur = sum(month);
    const old = sum(prevMonth);
    const keys = new Set([...cur.keys(), ...old.keys()]);
    return Array.from(keys)
      .map((category) => ({ category, diff: (cur.get(category) ?? 0) - (old.get(category) ?? 0) }))
      .filter((r) => Math.abs(r.diff) >= 5)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 6);
  }, [spaceRows, month, prevMonth]);

  const maxVar = Math.max(1, ...variacoes.map((v) => Math.abs(v.diff)));

  // ---- Médias
  const mediaMensal = useMemo(() => {
    const vals = Array.from(aggByMonth.values()).map((a) => a.out);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [aggByMonth]);
  const mediaDiaria = month === "all" ? 0 : gastosReais / Math.max(1, daysElapsed(month));
  const maiorGasto = useMemo(
    () =>
      inMonth.filter(contaComoGasto).sort((a, b) => b.amount - a.amount)[0],
    [inMonth]
  );

  // A lista de categorias cortada mantém as duas colunas com alturas parecidas.
  const catsShown = allCats ? byCategory : byCategory.slice(0, CAT_LIMIT);

  const recent = useMemo(() => inMonth.slice(0, 8), [inMonth]);

  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: 36, textAlign: "center" }}>
        <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>Ainda não há dados 📊</p>
        <p className="muted" style={{ margin: "0 0 16px" }}>
          Importa o extrato do banco e o dashboard preenche-se sozinho.
        </p>
        <a className="btn btn-primary" href="/import">
          📥 Importar extrato
        </a>
      </div>
    );
  }

  const last = series.length - 1;
  // Quem termina por cima leva o rótulo em cima; o outro por baixo — nunca colidem.
  const inIsHigher = last >= 0 ? series[last].rendimento >= series[last].gastos : true;
  // Rótulo direto só no último ponto (o Recharts não aceita null aqui → <g/> vazio).
  // `dy` fixo por série: quando as linhas se cruzam no fim, os rótulos não colidem.
  const endLabel = (color: string, dy: number) => (props: any) => {
    if (props.index !== last || series.length < 2) return <g />;
    return (
      <text x={props.x + 7} y={props.y + dy} textAnchor="start" fill={color} fontSize={11} fontWeight={700}>
        {eurAxis(props.value)}
      </text>
    );
  };

  return (
    <>
      <div className="toolbar">
        <select className="select sel-month" aria-label="Mês" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">Sempre</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <div className="spacer" />
      </div>

      {/* Saldo — número herói */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600 }}>
          Saldo · {monthLabel(month)}
        </div>
        <div
          className="num"
          style={{
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: "-.02em",
            marginTop: 2,
            color: saldo >= 0 ? "var(--good)" : "var(--bad)",
          }}
        >
          {saldo >= 0 ? "+" : "−"}
          {eur2(Math.abs(saldo))}
        </div>
        <div style={{ marginTop: 6 }}>
          <DeltaAbs cur={saldo} prev={prevSaldo} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Entrou {eur(entradas)} · saiu {eur(gastosReais)} em gastos · {eur(poupado)} para poupança · {eur(investido)} investido
        </div>
      </div>

      {/* KPIs com variação */}
      <div className="tiles tiles-4" style={{ marginTop: 12 }}>
        <div className="tile">
          <div className="label">Rendimento</div>
          <div className="big num" style={{ color: "var(--good)" }}>{eur(entradas)}</div>
          <Delta value={delta(entradas, prevAgg?.in)} goodWhenUp={true} />
        </div>
        <div className="tile">
          <div className="label">Gastos</div>
          <div className="big num" style={{ color: "var(--bad)" }}>{eur(gastosReais)}</div>
          <Delta value={delta(gastosReais, prevAgg?.out)} goodWhenUp={false} />
        </div>
        <div className="tile">
          <div className="label">Poupado</div>
          <div className="big num" style={{ color: "var(--accent-2)" }}>{eur(poupado)}</div>
          <Delta value={delta(poupado, prevAgg?.save)} goodWhenUp={true} />
        </div>
        <div className="tile">
          <div className="label">Investido</div>
          <div className="big num" style={{ color: "var(--good)" }}>{eur(investido)}</div>
          <Delta value={delta(investido, prevAgg?.inv)} goodWhenUp={true} />
        </div>
      </div>

      {/* Rendimento vs Gastos — 12 meses */}
      <div className="section-title">Rendimento vs gastos · últimos {series.length} meses</div>
      <div className="card" style={{ padding: "18px 12px 10px" }}>
        <div style={{ display: "flex", gap: 16, padding: "0 8px 10px", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600 }}>
            <span className="dot" style={{ background: CHART_IN }} /> Rendimento
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600 }}>
            <span className="dot" style={{ background: CHART_OUT }} /> Gastos
          </span>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={series} margin={{ top: 18, right: 52, left: 2, bottom: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: AXIS_INK, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: AXIS_INK, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={eurAxis}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: GRID, strokeWidth: 1 }}
              formatter={(v: number, n: string) => [eur2(v), n === "rendimento" ? "Rendimento" : "Gastos"]}
              labelFormatter={(l: string, p: any) => monthLabel(p?.[0]?.payload?.m ?? l)}
            />
            <Line
              type="monotone"
              dataKey="rendimento"
              stroke={CHART_IN}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
              label={endLabel(CHART_IN, inIsHigher ? -9 : 16)}
            />
            <Line
              type="monotone"
              dataKey="gastos"
              stroke={CHART_OUT}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
              label={endLabel(CHART_OUT, inIsHigher ? 16 : -9)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Linha 1 — donut | detalhe por categoria */}
      <div className="two-col">
        <div>
          <div className="section-title">Gastos · {monthLabel(month)}</div>
          <div className="card">
            <div className="hero">
              <div className="donut-wrap" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={donut.length ? donut : [{ category: "—", value: 1 }]}
                      dataKey="value"
                      nameKey="category"
                      innerRadius={78}
                      outerRadius={112}
                      paddingAngle={donut.length > 1 ? 2 : 0}
                      stroke="none"
                    >
                      {(donut.length ? donut : [{ category: "—", value: 1 }]).map((d) => (
                        <Cell key={d.category} fill={donut.length ? catColor(d.category) : "var(--surface-2)"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _n, p: any) => [eur2(v), p?.payload?.category]}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <div className="lbl">Gastos</div>
                  <div className="val num">{eur(gastosReais)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Médias — enchem a coluna esquerda até à altura da lista */}
          <div className="chips" style={{ marginTop: 12 }}>
            <div className="chip">
              <div className="k">Média/mês</div>
              <div className="v num">{eur(mediaMensal)}</div>
            </div>
            <div className="chip">
              <div className="k">Média/dia</div>
              <div className="v num">{month === "all" ? "—" : eur2(mediaDiaria)}</div>
            </div>
            <div className="chip">
              <div className="k">Maior gasto</div>
              <div className="v num">{maiorGasto ? eur(maiorGasto.amount) : "—"}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="section-title">Por categoria</div>
          <div className="card cat-list">
            {byCategory.length === 0 ? (
              <p className="muted" style={{ textAlign: "center", padding: 20 }}>Sem gastos neste mês.</p>
            ) : (
              catsShown.map((c) => (
                <div className="cat-row" key={c.category}>
                  <span className="dot" style={{ background: catColor(c.category) }} />
                  <span className="name">{c.category}</span>
                  <span className="pct num">{gastosReais ? Math.round((c.value / gastosReais) * 100) : 0}%</span>
                  <span className="amt num">{eur2(c.value)}</span>
                </div>
              ))
            )}
          </div>
          {byCategory.length > CAT_LIMIT && (
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setAllCats((v) => !v)}>
              {allCats ? "Ver menos" : `Ver todas (${byCategory.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Linha 2 — tipos de gasto | o que mudou */}
      <div className={variacoes.length > 0 && prevMonth ? "two-col" : undefined}>
        {byType.list.length > 0 && (
          <div>
            <div className="section-title">Para onde vai o dinheiro</div>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", gap: 2, height: 14, marginBottom: 14 }}>
                {byType.list.map((t) => (
                  <div
                    key={t.type}
                    title={`${t.type}: ${eur2(t.value)}`}
                    style={{
                      width: `${t.pct}%`,
                      background: TYPE_CHART_COLORS[t.type] ?? "#6b7280",
                      borderRadius: 4,
                    }}
                  />
                ))}
              </div>
              {byType.list.map((t) => (
                <div className="cat-row" key={t.type} style={{ padding: "7px 0" }}>
                  <span className="dot" style={{ background: TYPE_CHART_COLORS[t.type] ?? "#6b7280" }} />
                  <span className="name">{t.type}</span>
                  <span className="pct num">{Math.round(t.pct)}%</span>
                  <span className="amt num">{eur2(t.value)}</span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
                Inclui poupança/investimento. Total {eur2(byType.total)}.
              </p>
            </div>
          </div>
        )}

        {variacoes.length > 0 && prevMonth && (
          <div>
            <div className="section-title">O que mudou vs {monthLabel(prevMonth)}</div>
            <div className="card" style={{ padding: 18 }}>
              {variacoes.map((v) => {
                const up = v.diff > 0;
                return (
                  <div key={v.category} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                    <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{catIcon(v.category)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{v.category}</span>
                    <div style={{ width: "30%", display: "flex", justifyContent: up ? "flex-start" : "flex-end" }}>
                      <div
                        style={{
                          width: `${(Math.abs(v.diff) / maxVar) * 100}%`,
                          height: 8,
                          borderRadius: 4,
                          background: up ? CHART_OUT : CHART_IN,
                        }}
                      />
                    </div>
                    <span
                      className="num"
                      style={{ fontSize: 13.5, fontWeight: 800, minWidth: 72, textAlign: "right", color: up ? "var(--bad)" : "var(--good)" }}
                    >
                      {up ? "▲ +" : "▼ −"}
                      {eur(Math.abs(v.diff))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recentes */}
      <div className="section-title">Recentes</div>
      <div className="card mov-list">
        {recent.map((r) => (
          <div className="mov-row" key={r.id}>
            <span
              className="ic"
              style={{ background: `color-mix(in srgb, ${catColor(r.category)} 18%, transparent)` }}
            >
              {r.kind === "entrada" ? "💶" : catIcon(r.category)}
            </span>
            <div className="mid">
              <div className="t">
                {r.description}
                {r.flag === "R" && <span className="badge R" style={{ marginLeft: 8 }}>R</span>}
                {r.flag === "P" && <span className="badge P" style={{ marginLeft: 8 }}>P</span>}
              </div>
              <div className="s">
                {r.date.slice(8, 10)}/{r.date.slice(5, 7)} · {r.category}
                {r.account ? ` · ${r.account}` : ""}
              </div>
            </div>
            <span className={r.kind === "entrada" ? "amount-in" : "amount-out"}>
              {r.kind === "entrada" ? "+" : "−"}
              {eur2(r.amount)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
