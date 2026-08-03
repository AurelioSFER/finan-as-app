// Orçamento mensal planeado (página Plano).
// Vive aqui para o Plano e os Objetivos usarem exatamente os mesmos números.

export type Budgets = Record<string, number>;

export const SEED_PESSOAL: Budgets = { rendimento: 1050, Fixos: 565, Necessários: 200, Supérfluos: 200, Poupança: 85 };
export const SEED_CONJUNTA: Budgets = { rendimento: 600, Fixos: 0, Necessários: 300, Supérfluos: 240, Poupança: 60 };

export function seedFor(space: string): Budgets {
  return space === "conjunta" ? SEED_CONJUNTA : SEED_PESSOAL;
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
