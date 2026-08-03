// Tokens de cor para os gráficos do dashboard.
//
// Validados com o validador de paletas (OKLCH, modo dark, surface #0f0f14):
//   #00a37f,#e06a45                    -> 6/6 PASS  (série rendimento vs gastos)
//   #4a90e2,#b8790f,#c94f8a,#8b6ff0    -> 6/6 PASS  (tipos, por esta ordem)
// Se mudares um destes hex, volta a correr o validador: a separação para
// daltonismo (deutan/protan) é a que se estraga primeiro.

export const CHART_IN = "#00a37f"; // rendimento / entradas
export const CHART_OUT = "#e06a45"; // gastos
export const CHART_SAVE = "#8b6ff0"; // poupado / investido

// Fixos, Necessários, Supérfluos, Poupança — a ordem importa (pares adjacentes).
export const TYPE_CHART_COLORS: Record<string, string> = {
  Fixos: "#4a90e2",
  Necessários: "#b8790f",
  Supérfluos: "#c94f8a",
  Poupança: "#8b6ff0",
  "Por classificar": "#6b7280",
};

export const TYPE_ORDER = ["Fixos", "Necessários", "Supérfluos", "Poupança", "Por classificar"];

export const GRID = "rgba(255,255,255,0.06)";
export const AXIS_INK = "#626675";

export const tooltipStyle = {
  background: "#15151c",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  color: "#f6f7fa",
  fontSize: 13,
  boxShadow: "0 18px 50px rgba(0,0,0,.5)",
} as const;
