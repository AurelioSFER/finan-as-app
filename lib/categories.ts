// Taxonomia de categorias e contas — alinhada com a análise dos 7 meses.
// Muda à vontade: é só editar estas listas.

export const CATEGORIES = [
  "Renda",
  "Conta conjunta",
  "Supermercado",
  "Comer fora",
  "Comer fora trabalho",
  "Cafés",
  "Cafés trabalho",
  "Combustível",
  "Carro",
  "Roupa",
  "Prendas",
  "Cão",
  "Saúde",
  "Subscrições",
  "Apostas",
  "Convívio",
  "Viagens",
  "Casa",
  "Ginásio",
  "Salário",
  "Poupança",
  "Investimento",
  "Fundo emergência",
  "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Categorias que são poupança / investimento — não são "gasto", mas saem da conta.
export const SAVINGS_CATEGORIES = ["Poupança", "Investimento", "Fundo emergência"];

// Um movimento pode ir direto para um objetivo. Fica guardado na própria
// categoria, com este prefixo — não é preciso coluna nova na base de dados.
export const GOAL_PREFIX = "Objetivo: ";

export function goalCategory(name: string): string {
  return GOAL_PREFIX + name;
}
export function isGoalCategory(category: string): boolean {
  return category.startsWith(GOAL_PREFIX);
}
export function goalNameOf(category: string): string | null {
  return isGoalCategory(category) ? category.slice(GOAL_PREFIX.length) : null;
}
/** Sai da conta mas não é consumo: poupança, investimento ou um objetivo. */
export function isSavings(category: string): boolean {
  return SAVINGS_CATEGORIES.includes(category) || isGoalCategory(category);
}

export const ACCOUNTS = ["Caixa", "Revolut", "Conjunta", "Trade Republic", "XTB"] as const;
export type Account = (typeof ACCOUNTS)[number];

// gasto = sai dinheiro | entrada = entra dinheiro
export const KINDS = ["gasto", "entrada"] as const;
export type Kind = (typeof KINDS)[number];

// Flags: R = reembolso, P = prenda.
//
// O R serve os dois lados da mesma história e o `kind` decide qual:
//   num gasto   -> não conta (só usar quando a devolução não entra na app)
//   numa entrada-> não é rendimento, abate ao gasto da mesma categoria
export const FLAGS = [
  { value: "", label: "—" },
  { value: "R", label: "Reembolso" },
  { value: "P", label: "Prenda" },
] as const;

export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  kind: Kind;
  category: string;
  account: string;
  /** Preenchido só nas transferências: a conta tua onde o dinheiro entrou. */
  to_account?: string | null;
  flag: string | null;
  notes: string | null;
  created_at?: string;
};

// ---- Um movimento conta como gasto? ----
// A regra vive só aqui. Está usada no dashboard, no plano, nos objetivos e
// nas sugestões — se cada um tiver a sua cópia, os ecrãs deixam de bater
// certo uns com os outros à primeira exceção nova.

type Movimento = {
  kind: string;
  flag: string | null;
  category: string;
  to_account?: string | null;
};

/** Dinheiro teu que mudou de conta: sai daqui, entra noutra conta tua. */
export function isTransfer(r: Movimento): boolean {
  return !!r.to_account;
}

/** Saiu mesmo da conta: nem reembolsado, nem transferência interna. */
export function saiuDaConta(r: Movimento): boolean {
  return r.kind === "gasto" && r.flag !== "R" && !isTransfer(r);
}

/** Saiu e foi consumido — o "gasto real" dos totais. */
export function contaComoGasto(r: Movimento): boolean {
  return saiuDaConta(r) && !isSavings(r.category);
}

/** Saiu mas guardaste — poupança, investimento ou objetivo. */
export function contaComoPoupanca(r: Movimento): boolean {
  return saiuDaConta(r) && isSavings(r.category);
}

/** Entrou dinheiro novo. Uma transferência tua ou um reembolso não são rendimento. */
export function contaComoEntrada(r: Movimento): boolean {
  return r.kind === "entrada" && !isTransfer(r) && r.flag !== "R";
}

/**
 * Quanto é que este movimento pesa nos gastos.
 *
 * Positivo quando saiu dinheiro, **negativo quando voltou**, zero quando não
 * conta. É isto que permite ter uma prenda de 100 € com 75 € devolvidos a
 * aparecer como 25 € gastos em `Prendas`, em vez de 100 € de gasto e 75 € de
 * rendimento que nunca ganhaste.
 *
 * Todo o dinheiro que entra tem de aterrar algures ou o saldo deixa de bater:
 * ou é rendimento (a predefinição), ou é dinheiro a voltar e abate ao gasto.
 * A marca `R` é que escolhe, movimento a movimento — nunca é automática.
 */
export function pesoNoGasto(r: Movimento & { amount: number }): number {
  if (isTransfer(r)) return 0;
  if (r.kind === "entrada") return r.flag === "R" ? -r.amount : 0;
  // Um gasto marcado como reembolsado só se apaga quando a devolução não
  // chega a entrar na app (te pagaram em numerário). Se importares a entrada,
  // marca-a a ela — senão o gasto desaparece e o dinheiro entra duas vezes.
  return r.flag === "R" ? 0 : r.amount;
}

// Accent principal (estilo Revolut: violeta elétrico).
export const ACCENT = "#7c6bff";

// Cor por categoria — a cor segue a categoria (não o ranking).
export const CATEGORY_COLORS: Record<string, string> = {
  Renda: "#7c6bff",
  "Conta conjunta": "#b197fc",
  Supermercado: "#21c7a8",
  "Comer fora": "#ff6b9d",
  "Comer fora trabalho": "#e64980",
  Cafés: "#ff8f5e",
  "Cafés trabalho": "#e8763b",
  Combustível: "#ffb020",
  Carro: "#5c7cfa",
  Roupa: "#4dabf7",
  Prendas: "#f06595",
  Cão: "#63e6be",
  Saúde: "#74c0fc",
  Subscrições: "#9775fa",
  Apostas: "#ff8787",
  Convívio: "#cc5de8",
  Viagens: "#3bc9db",
  Casa: "#a9e34b",
  Ginásio: "#ffa94d",
  Salário: "#37b24d",
  Poupança: "#38d9a9",
  Investimento: "#22b8cf",
  "Fundo emergência": "#ffa94d",
  Outros: "#868e96",
};

export function catColor(category: string): string {
  if (isGoalCategory(category)) return ACCENT;
  return CATEGORY_COLORS[category] ?? "#868e96";
}

// Emoji por categoria (para os ícones das listas).
export const CATEGORY_ICONS: Record<string, string> = {
  Renda: "🏠",
  "Conta conjunta": "💞",
  Supermercado: "🛒",
  "Comer fora": "🍽️",
  "Comer fora trabalho": "🍱",
  Cafés: "☕",
  "Cafés trabalho": "🥪",
  Combustível: "⛽",
  Carro: "🚗",
  Roupa: "👕",
  Prendas: "🎁",
  Cão: "🐶",
  Saúde: "💊",
  Subscrições: "📱",
  Apostas: "🎰",
  Convívio: "🍻",
  Viagens: "✈️",
  Casa: "🛋️",
  Ginásio: "🏋️",
  Salário: "💵",
  Poupança: "💰",
  Investimento: "📈",
  "Fundo emergência": "🛟",
  Outros: "•",
};

export function catIcon(category: string): string {
  if (isGoalCategory(category)) return "🎯";
  return CATEGORY_ICONS[category] ?? "•";
}

// ---- Tipos de gasto (Fixos / Necessários / Supérfluos / Poupança) ----
export const TYPE_COLORS: Record<string, string> = {
  Fixos: "#4dabf7",
  Necessários: "#21c7a8",
  Supérfluos: "#ff6b9d",
  Poupança: "#38d9a9",
  Rendimento: "#37b24d",
  "Por classificar": "#868e96",
};

export const CATEGORY_TYPE: Record<string, string> = {
  Renda: "Fixos",
  "Conta conjunta": "Fixos",
  Ginásio: "Fixos",
  Subscrições: "Fixos",
  Supermercado: "Necessários",
  Combustível: "Necessários",
  Carro: "Necessários",
  Saúde: "Necessários",
  Cão: "Necessários",
  Casa: "Necessários",
  "Comer fora trabalho": "Necessários",
  "Comer fora": "Supérfluos",
  Cafés: "Supérfluos",
  "Cafés trabalho": "Supérfluos",
  Roupa: "Supérfluos",
  Prendas: "Supérfluos",
  Apostas: "Supérfluos",
  Convívio: "Supérfluos",
  Viagens: "Supérfluos",
  Poupança: "Poupança",
  Investimento: "Poupança",
  "Fundo emergência": "Poupança",
  Salário: "Rendimento",
  Outros: "Por classificar",
};

export function typeOf(category: string): string {
  // dinheiro que vai para um objetivo conta como poupança no Plano
  if (isGoalCategory(category)) return "Poupança";
  return CATEGORY_TYPE[category] ?? "Por classificar";
}
