// Lê um extrato colado (Caixa ou Revolut) e devolve movimentos limpos.

export type ParsedRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  kind: "gasto" | "entrada";
};

export type ParseResult = {
  rows: ParsedRow[];
  format: "Caixa" | "Revolut" | "desconhecido";
  skipped: number; // transferências internas / ruído ignorados
};

// Movimentos que são dinheiro a mudar de conta (não são gasto real).
const INTERNAL =
  /(CAR WAL CRT DEB REVOL|CARREGAMENTO COM CART|ARREDONDAMENTO DE TROCOS|REVOLUT BANK UAB|TRF CXDAPP|TRF CAIXADIRECTA|TRF IMEDIATA|IMPOSTO SELO|COMISSAO COMPRAS FORA)/i;

function splitCSV(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === sep && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// "1.234,56" -> 1234.56  (formato português da Caixa)
function parseEURpt(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

export function parseStatement(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/);
  const isRevolut = /montante/i.test(raw) && /tipo/i.test(raw);

  const rows: ParsedRow[] = [];
  let skipped = 0;

  if (isRevolut) {
    for (const line of lines) {
      if (!line.trim()) continue;
      const f = splitCSV(line, ",");
      if (f.length < 6) continue;
      if (/^tipo$/i.test(f[0])) continue; // cabeçalho
      const desc = (f[4] || "").trim();
      const montante = parseFloat(f[5]);
      const dateRaw = (f[3] || f[2] || "").trim();
      const date = dateRaw.slice(0, 10);
      if (!desc || isNaN(montante) || montante === 0) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (INTERNAL.test(desc)) {
        skipped++;
        continue;
      }
      rows.push({
        date,
        description: desc,
        amount: Math.abs(montante),
        kind: montante < 0 ? "gasto" : "entrada",
      });
    }
    return { rows, format: "Revolut", skipped };
  }

  // Caixa (separado por ponto-e-vírgula)
  let looksCaixa = false;
  for (const line of lines) {
    if (!line.includes(";")) continue;
    const f = line.split(";").map((s) => s.trim());
    const m = f[0].match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) continue; // linhas de cabeçalho / meta
    looksCaixa = true;
    const date = `${m[3]}-${m[2]}-${m[1]}`;
    const desc = (f[2] || "").trim();
    const debito = parseEURpt(f[3] || "");
    const credito = parseEURpt(f[4] || "");
    if (!desc) continue;
    if (INTERNAL.test(desc)) {
      skipped++;
      continue;
    }
    if (debito > 0) rows.push({ date, description: desc, amount: debito, kind: "gasto" });
    else if (credito > 0) rows.push({ date, description: desc, amount: credito, kind: "entrada" });
  }

  return { rows, format: looksCaixa ? "Caixa" : "desconhecido", skipped };
}
