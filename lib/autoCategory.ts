// Categorização automática por palavras-chave — o "cérebro" inicial,
// antes de a memória (merchant_rules) aprender. Primeira regra que bate ganha.

function norm(s: string): string {
  return " " + s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "") + " ";
}

const RULES: Array<{ words: string[]; category: string }> = [
  { category: "Salário", words: ["salario", "ordenado", "vencimento", "tfgest gestao"] },
  { category: "Apostas", words: ["betano", "betclic", "casino", "placard", "solverde", "bwin", "pokerstars", "888", "trustly"] },
  { category: "Supermercado", words: ["pingo doce", "pingo d", "continente", "mercadona", "auchan", "lidl", "minipreco", "intermarche", "aldi", "el corte", "spar", "froiz"] },
  { category: "Combustível", words: ["galp", "repsol", "cepsa", "prio", " bp ", "gasolin", "posto", "p.a", "combusti", "petrogal"] },
  { category: "Carro", words: ["lavagem", "lava auto", "lava-auto", "lavauto", "car wash", "carwash", "oficina", "pneus", "kim pneus", "controlauto", "inspecao", "via verde", "portagem", "brisa", "estacionamento", "parque de est"] },
  { category: "Cão", words: ["kiwoko", "tiendanimal", "masquepet", "wepet", "maspet", "veterinar", "clinica vet", " pet ", "animal"] },
  { category: "Saúde", words: ["farmacia", "parafarm", "hospital", "clinica", "dentist", "analises", "wells", "medic", "hosp luz"] },
  { category: "Ginásio", words: ["ginasio", "fitness", " gym", "ctflex", "holmes", "smartclub", "fitnesshut"] },
  { category: "Subscrições", words: ["netflix", "spotify", "hbo", "disney", "youtube", "chatgpt", "openai", "claude", "anthropic", "icloud", "apple.com", "prime video", "dazn"] },
  { category: "Viagens", words: ["ryanair", "easyjet", " tap ", "hotel", "booking", "airbnb", "flixbus", "comboios", "uber", "bolt", "alsa", "aeroport", "piscinas", "souv", "eira ser"] },
  { category: "Roupa", words: ["zara", "massimo", "stradiv", "pull", "bershka", "lefties", "springfield", "mango", "sport zone", "nike", "adidas", "sacoor", "primark", " hm", "decathlon", "fnac"] },
  { category: "Cafés", words: ["pastelaria", "padaria", "confeitaria", " cafe", "café", "delta", "starbucks", "areal", "llaollao", "gelatar", " doce", "bacio", "coconuts", "past mi", "atelier", "pantir", "desejos"] },
  { category: "Convívio", words: ["discoteca", "pub", "balada", "bowling", "bilhar", "cocktail", "boate"] },
  { category: "Comer fora", words: ["restaurante", "mcdonald", "burger king", " kfc", "pizzar", "pizza", "sushi", "churrasc", "telepizza", " h3 ", "tasca", "taberna", "marisqueira", "snack", "hamburgueria", " bar ", "food", "steakhouse", "glamour", "forever", "tapas", "moinho", "emporio", "turvize", "bolama", "monte alegre", "salado", "limonete", "tomatino", "contentor", "beiral", "ninki", "vermoim", "capitan", "areas", "sanches"] },
  { category: "Casa", words: ["ikea", "leroy", " aki ", "worten", "action", "tedi", "flying tiger", "primor", "perfum", "cakus", "ceramica"] },
  { category: "Renda", words: ["renda"] },
];

export function autoCategory(description: string): string | null {
  const d = norm(description);
  for (const rule of RULES) {
    if (rule.words.some((w) => d.includes(w))) return rule.category;
  }
  return null;
}
