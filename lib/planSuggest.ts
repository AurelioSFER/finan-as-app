// Lê o histórico de gastos e propõe o plano do mês.
// A base é a MEDIANA e não a média: um mês com uma despesa fora do vulgar
// (um seguro, uma avaria) puxava a média para cima e o plano ficava folgado
// de mais todos os meses.

import { typeOf, contaComoEntrada, isTransfer, pesoNoGasto, type Expense } from "./categories";
import { RUBRICAS, type Extra, type Rubrica } from "./plan";

export type Stat = {
  mediana: number;
  media: number;
  min: number;
  max: number;
  /** Total de cada mês da janela, do mais antigo para o mais recente. */
  meses: { m: string; v: number }[];
};

export type Analise = {
  /** Meses usados na análise, do mais antigo para o mais recente. */
  meses: string[];
  rubricas: Record<string, Stat>;
  /** Gastos em categorias sem rubrica ("Outros") — não entram em nenhuma linha do Plano. */
  porClassificar: Stat;
  rendimento: Stat;
  /** Entradas já registadas no mês que se está a planear (o salário, depois do import). */
  rendimentoDoMes: number;
};

export type Sugestao = {
  rendimento: number;
  Fixos: number;
  Necessários: number;
  Supérfluos: number;
  Poupança: number;
};

function monthOf(d: string) {
  return d.slice(0, 7);
}

function stat(meses: { m: string; v: number }[]): Stat {
  if (meses.length === 0) return { mediana: 0, media: 0, min: 0, max: 0, meses: [] };
  const vals = meses.map((x) => x.v).sort((a, b) => a - b);
  const meio = Math.floor(vals.length / 2);
  const mediana = vals.length % 2 ? vals[meio] : (vals[meio - 1] + vals[meio]) / 2;
  return {
    mediana,
    media: vals.reduce((a, b) => a + b, 0) / vals.length,
    min: vals[0],
    max: vals[vals.length - 1],
    meses,
  };
}

/**
 * @param rows   movimentos já filtrados pelo espaço (pessoal/conjunta)
 * @param alvo   mês a planear, "YYYY-MM"
 * @param janela quantos meses anteriores olhar
 */
export function analisar(rows: Expense[], alvo: string, janela = 6): Analise {
  const anteriores = Array.from(new Set(rows.map((r) => monthOf(r.date))))
    .filter((m) => m < alvo)
    .sort();
  const meses = anteriores.slice(-janela);

  // O peso é negativo quando é dinheiro a voltar, por isso um reembolso abate
  // à rubrica que o originou em vez de inflacionar o rendimento do mês.
  const soma = (m: string, teste: (r: Expense) => boolean) =>
    rows
      .filter((r) => monthOf(r.date) === m && teste(r))
      .reduce((a, r) => a + pesoNoGasto(r), 0);

  const rubricas: Record<string, Stat> = {};
  for (const k of [...RUBRICAS, "Poupança"]) {
    rubricas[k] = stat(meses.map((m) => ({ m, v: soma(m, (r) => typeOf(r.category) === k) })));
  }

  const porClassificar = stat(
    meses.map((m) => ({ m, v: soma(m, (r) => typeOf(r.category) === "Por classificar") }))
  );

  const rendimento = stat(
    meses.map((m) => ({
      m,
      v: rows
        .filter((r) => contaComoEntrada(r) && monthOf(r.date) === m)
        .reduce((a, r) => a + r.amount, 0),
    }))
  );

  const rendimentoDoMes = rows
    .filter((r) => contaComoEntrada(r) && monthOf(r.date) === alvo)
    .reduce((a, r) => a + r.amount, 0);

  return { meses, rubricas, porClassificar, rendimento, rendimentoDoMes };
}

/**
 * Quanto costuma sair em cada categoria por mês, na mesma janela que a sugestão
 * usa. Serve para abrir uma rubrica do Plano e ver de que é que ela é feita —
 * inclusive as categorias que ainda não apareceram no mês corrente.
 */
export function medianaPorCategoria(rows: Expense[], alvo: string, janela = 6): Record<string, number> {
  const meses = Array.from(new Set(rows.map((r) => monthOf(r.date))))
    .filter((m) => m < alvo)
    .sort()
    .slice(-janela);
  if (meses.length === 0) return {};

  const naJanela = new Set(meses);
  const porCat = new Map<string, Map<string, number>>();
  for (const r of rows) {
    // rendimento entra pelo valor; tudo o resto pelo peso, que já é zero nas
    // transferências e negativo no dinheiro que voltou
    const v = contaComoEntrada(r) ? r.amount : pesoNoGasto(r);
    if (v === 0) continue;
    const m = monthOf(r.date);
    if (!naJanela.has(m)) continue;
    const mm = porCat.get(r.category) ?? new Map<string, number>();
    mm.set(m, (mm.get(m) ?? 0) + v);
    porCat.set(r.category, mm);
  }

  const out: Record<string, number> = {};
  for (const [cat, mm] of porCat) {
    // um mês sem nada nesta categoria conta como zero, senão a mediana inflaciona
    out[cat] = stat(meses.map((m) => ({ m, v: mm.get(m) ?? 0 }))).mediana;
  }
  return out;
}

/** Soma dos extras previstos, por rubrica. */
export function extrasPorRubrica(extras: Extra[]): Record<Rubrica, number> {
  const out = { Fixos: 0, Necessários: 0, Supérfluos: 0 } as Record<Rubrica, number>;
  for (const e of extras) out[e.rubrica] = (out[e.rubrica] ?? 0) + e.amount;
  return out;
}

/**
 * O plano proposto: cada rubrica fica na mediana do histórico mais os extras
 * que lhe atribuíste, e a Poupança leva tudo o que sobrar do rendimento.
 */
export function sugerir(a: Analise, extras: Extra[], rendimentoManual?: number): Sugestao {
  const ex = extrasPorRubrica(extras);
  const rendimento = Math.round(rendimentoManual ?? (a.rendimentoDoMes || a.rendimento.mediana));
  const Fixos = Math.round(a.rubricas.Fixos.mediana + ex.Fixos);
  const Necessários = Math.round(a.rubricas["Necessários"].mediana + ex["Necessários"]);
  const Supérfluos = Math.round(a.rubricas["Supérfluos"].mediana + ex["Supérfluos"]);
  const Poupança = Math.max(0, Math.round(rendimento - Fixos - Necessários - Supérfluos));
  return { rendimento, Fixos, Necessários, Supérfluos, Poupança };
}
