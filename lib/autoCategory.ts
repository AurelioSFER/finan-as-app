// Categorização automática por palavras-chave — o "cérebro" inicial,
// antes de a memória (merchant_rules) aprender. Primeira regra que bate ganha.
//
// As palavras são procuradas como pedaço de texto, não como palavra inteira:
// "pub" apanhava "publico" e "republica". Quando um termo curto puder viver
// dentro de outro, rodeia-o de espaços — a descrição é normalizada com um
// espaço de cada lado, por isso " posto" prende o início da palavra.

function norm(s: string): string {
  return " " + s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "") + " ";
}

const RULES: Array<{ words: string[]; category: string }> = [
  // O banco escreve a conta conjunta com os dois nomes ligados por "&". Fica em
  // primeiro por ser a regra mais específica de todas — o "&" só aparece aqui.
  { category: "Conta conjunta", words: ["& francisca", "& aurelio"] },
  // O cartao de refeicao carrega-se todos os meses com o subsidio: fica antes
  // do Salario para nao ser confundido com o ordenado.
  { category: "Subsídio alimentação", words: ["carregamento de alimenta", "subsidio de alimenta", "subsidio alimenta", "coverflex", "edenred", "cartao refeicao"] },
  { category: "Salário", words: ["salario", "ordenado", "vencimento", "tfgest gestao"] },
  { category: "Apostas", words: ["betano", "betclic", "casino", "placard", "solverde", "bwin", "pokerstars", "888", "trustly"] },
  { category: "Supermercado", words: ["pingo doce", "pingo d", "contine", "mercadona", "auchan", "lidl", "minipreco", "intermarche", "aldi", "el cort", "spar", "froiz", "leclerc", "e lecle", "superme"] },
  { category: "Combustível", words: ["galp", "repsol", "cepsa", "prio", " bp ", "gasolin", " posto", "p.a", "tfgest", "combusti", "petrogal"] },
  { category: "Carro", words: ["lavagem", "lava auto", "lava-auto", "lavauto", "car wash", "carwash", "oficina", "pneus", "kim pneus", "controlauto", "inspecao", "via verde", "portagem", "brisa", "estacionamento", "parque de est"] },
  { category: "Cão", words: ["kiwoko", "tiendanimal", "masquepet", "wepet", "maspet", "veterinar", "clinica vet", " pet ", "animal"] },
  { category: "Cabeleireiro", words: ["cabeleireir", "barbearia", "barbeiro", "barber", " hair", "salao de beleza", "estetica"] },
  { category: "Saúde", words: ["farmaci", "parafarm", "hospital", "clinica", "dentist", "analises", "wells", "medic", "hosp luz"] },
  // "cxdapp" fica de fora de proposito: e o codigo generico de qualquer
  // transferencia feita na app da Caixa, nao identifica a Indeg.
  { category: "Formação", words: ["indeg", "iscte", "formacao", " curso"] },
  { category: "Padel", words: ["padel", "padle"] },
  // O "imposto selo" das comissoes esta na lista do POR_DECIDIR e nem
  // chega aqui; estas apanham o IUC do carro e o acerto do IRS.
  { category: "Impostos", words: [" irs", " iuc", "imposto", "financas"] },
  { category: "Ginásio", words: ["ginasio", "fitness", " gym", "ctflex", "holmes", "smartclub", "fitnesshut"] },
  { category: "Subscrições", words: ["netflix", "spotify", "hbo", "disney", "youtube", "chatgpt", "openai", "claude", "anthropic", "icloud", "apple.com", "prime video", "dazn"] },
  { category: "Viagens", words: ["ryanair", "easyjet", " tap ", "hotel", "booking", "airbnb", "flixbus", "comboios", "uber", "bolt", "alsa", "aeroport", "piscinas", "souv", "eira ser"] },
  { category: "Roupa", words: ["zara", "massimo", "stradiv", "pull", "bershka", "lefties", "springfield", "mango", "sport zone", "nike", "adidas", "sacoor", "primark", " hm", "decathlon", "fnac"] },
  { category: "Cafés", words: ["pastelaria", "padaria", "confeitaria", " cafe", "café", "delta", "starbucks", "areal", "llaollao", "gelatar", " doce", "bacio", "coconuts", "past mi", "atelier", "pantir", "desejos"] },
  { category: "Convívio", words: ["discoteca", " pub ", "balada", "bowling", "bilhar", "cocktail", "boate"] },
  { category: "Comer fora", words: [" rest ", "restaur", "mcdonald", "burger king", " kfc", "pizzar", "pizza", "sushi", "churras", "telepizza", " h3 ", "tasca", "taberna", "marisqueira", "snack", "hamburgueria", " bar ", "food", "steakhouse", "glamour", "forever", "tapas", "moinh", "emporio", "turvize", "bolama", "monte alegre", "salado", "limonete", "tomatin", "content", "beiral", "ninki", "vermoim", "capitan", "areas", "sanches"] },
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
