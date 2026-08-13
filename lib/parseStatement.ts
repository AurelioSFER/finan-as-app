// Lê um extrato colado (Caixa ou Revolut) e devolve movimentos limpos.

import { classifyTransfer, POR_DECIDIR, type Espaco } from "./transfers";

export type ParsedRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  kind: "gasto" | "entrada";
  /** Dinheiro que mudou de conta tua — sai da conta, mas não é consumo. */
  isTransfer: boolean;
  /** Conta de destino, quando a descrição a identifica. null = decides tu. */
  toAccount: string | null;
};

export type ParseResult = {
  rows: ParsedRow[];
  format: "Caixa" | "Revolut" | "desconhecido";
  skipped: number; // espelhos de transferências + ruído por decidir
};

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

/**
 * Decide se a linha entra, e com que destino.
 * Devolve null quando a linha deve ser descartada.
 */
function classify(
  description: string,
  kind: "gasto" | "entrada",
  espaco: Espaco
): { isTransfer: boolean; toAccount: string | null } | null {
  if (POR_DECIDIR.test(description)) return null;

  const t = classifyTransfer(description, kind, espaco);
  if (t === null) return { isTransfer: false, toAccount: null };

  // A perna de entrada é o espelho de uma saída já registada no outro
  // extrato — guardar as duas contava o dinheiro a dobrar.
  if (t.leg === "entrada") return null;

  return { isTransfer: true, toAccount: t.to };
}

/**
 * @param espaco qual das duas contabilidades está a receber este extrato — o
 *               mesmo texto do banco significa coisas diferentes conforme o livro.
 */
export function parseStatement(raw: string, espaco: Espaco = "pessoal"): ParseResult {
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

      const kind = montante < 0 ? "gasto" : "entrada";
      const c = classify(desc, kind, espaco);
      if (!c) {
        skipped++;
        continue;
      }
      rows.push({ date, description: desc, amount: Math.abs(montante), kind, ...c });
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
    if (debito <= 0 && credito <= 0) continue;

    const kind = debito > 0 ? "gasto" : "entrada";
    const c = classify(desc, kind, espaco);
    if (!c) {
      skipped++;
      continue;
    }
    rows.push({ date, description: desc, amount: debito > 0 ? debito : credito, kind, ...c });
  }

  return { rows, format: looksCaixa ? "Caixa" : "desconhecido", skipped };
}
