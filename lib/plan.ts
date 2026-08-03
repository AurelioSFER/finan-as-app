// Orçamento mensal planeado (página Plano).
// Vive aqui para o Plano e os Objetivos usarem exatamente os mesmos números.
//
// A tabela `budgets` é chave-valor, por isso o mês e os extras cabem na chave:
//   pessoal:Fixos                        -> plano antigo, sem mês (fica como base)
//   pessoal:2026-08:Fixos                -> plano do mês
//   pessoal:2026-08:extra:Supérfluos:Férias -> despesa pontual prevista para o mês

export type Budgets = Record<string, number>;

export const SEED_PESSOAL: Budgets = { rendimento: 1050, Fixos: 565, Necessários: 200, Supérfluos: 200, Poupança: 85 };
export const SEED_CONJUNTA: Budgets = { rendimento: 600, Fixos: 0, Necessários: 300, Supérfluos: 240, Poupança: 60 };

/** Rubricas de saída, pela ordem em que aparecem no Plano. */
export const RUBRICAS = ["Fixos", "Necessários", "Supérfluos"] as const;
export type Rubrica = (typeof RUBRICAS)[number];

export function seedFor(space: string): Budgets {
  return space === "conjunta" ? SEED_CONJUNTA : SEED_PESSOAL;
}

/** Uma despesa pontual prevista para um mês (férias, seguro, prendas…). */
export type Extra = { label: string; amount: number; rubrica: Rubrica };

export type BudgetRow = { key: string; planned: number };
export type ParsedBudgets = {
  /** Plano sem mês — o formato antigo, usado como base. */
  base: Budgets;
  /** Plano de cada mês. */
  porMes: Record<string, Budgets>;
  /** Extras previstos de cada mês. */
  extras: Record<string, Extra[]>;
};

const MONTH_RE = /^\d{4}-\d{2}$/;

function limpa(s: string) {
  // os dois pontos separam a chave — trocá-los por espaço não pode deixar espaços a dobrar
  return s.replace(/:/g, " ").replace(/\s+/g, " ").trim();
}

export function planKey(space: string, month: string, rubrica: string) {
  return month === "all" ? `${space}:${rubrica}` : `${space}:${month}:${rubrica}`;
}
export function extraKey(space: string, month: string, e: Extra) {
  return `${space}:${month}:extra:${e.rubrica}:${limpa(e.label)}`;
}
export function extraPrefix(space: string, month: string) {
  return `${space}:${month}:extra:`;
}

export function parseBudgetRows(rows: BudgetRow[], space: string): ParsedBudgets {
  const out: ParsedBudgets = { base: {}, porMes: {}, extras: {} };
  for (const r of rows) {
    const p = r.key.split(":");
    if (p[0] !== space) continue;
    const v = Number(r.planned);
    if (p.length === 2) {
      out.base[p[1]] = v;
      continue;
    }
    if (p.length < 3 || !MONTH_RE.test(p[1])) continue;
    const m = p[1];
    if (p[2] === "extra") {
      const rubrica = p[3] as Rubrica;
      const label = p.slice(4).join(" ");
      if (!label || !RUBRICAS.includes(rubrica)) continue;
      (out.extras[m] ??= []).push({ label, amount: v, rubrica });
    } else {
      (out.porMes[m] ??= {})[p[2]] = v;
    }
  }
  return out;
}

/** Um mês só tem plano próprio depois de alguém lhe mexer ou de o gerar. */
export function hasOwnPlan(month: string, parsed: ParsedBudgets) {
  return month !== "all" && !!parsed.porMes[month];
}

/** De que mês vem o plano que está a valer neste mês (null = base/arranque). */
export function inheritedFrom(month: string, parsed: ParsedBudgets): string | null {
  if (month === "all" || parsed.porMes[month]) return null;
  const anteriores = Object.keys(parsed.porMes)
    .filter((m) => m < month)
    .sort();
  return anteriores[anteriores.length - 1] ?? null;
}

/** O plano em vigor num mês.
 *  Os planos empilham-se por ordem cronológica: cada rubrica fica com o último
 *  valor que lhe foi dado até àquele mês. Assim, mexer só nos Supérfluos de
 *  Agosto não faz os Fixos voltarem ao valor de arranque. */
export function planForMonth(space: string, month: string, parsed: ParsedBudgets): Budgets {
  const out: Budgets = { ...seedFor(space), ...parsed.base };
  if (month === "all") return out;
  for (const m of Object.keys(parsed.porMes).sort()) {
    if (m <= month) Object.assign(out, parsed.porMes[m]);
  }
  return out;
}

export type Capacity = {
  /** O que planeaste poupar todos os meses. */
  poupanca: number;
  /** O que o orçamento deixa por atribuir (pode ser negativo se planeaste gastar a mais). */
  sobra: number;
  /** Quanto há mesmo por mês para objetivos. Nunca negativo. */
  total: number;
};

/** Quanto é que o plano liberta por mês para os objetivos. */
export function planCapacity(b: Budgets): Capacity {
  const poupanca = b["Poupança"] ?? 0;
  const gastos = (b["Fixos"] ?? 0) + (b["Necessários"] ?? 0) + (b["Supérfluos"] ?? 0);
  const sobra = (b["rendimento"] ?? 0) - gastos - poupanca;
  return { poupanca, sobra, total: Math.max(0, poupanca + sobra) };
}
