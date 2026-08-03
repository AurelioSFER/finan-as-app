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

// Flags: R = reembolsado (recebes/recebeste de volta), P = prenda
export const FLAGS = [
  { value: "", label: "—" },
  { value: "R", label: "Reembolsado" },
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
  flag: string | null;
  notes: string | null;
  created_at?: string;
};

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
