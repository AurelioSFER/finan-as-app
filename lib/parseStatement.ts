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

/** Porque é que uma linha não entrou por si só. */
export type Motivo = "espelho" | "por decidir";

export type Descartada = ParsedRow & { motivo: Motivo };

export type ParseResult = {
  rows: ParsedRow[];
  format: "Caixa" | "Revolut" | "desconhecido";
  /**
   * Linhas que o leitor não guarda sozinho, com o motivo. Não são deitadas
   * fora: vão para a tabela desmarcadas, para quem importa poder discordar.
   * Uma entrada com o nome do titular pode ser dinheiro dele a voltar, ou
   * dinheiro de um familiar com o mesmo nome — o extrato escreve igual, e
   * quem sabe a diferença é quem está a olhar.
   */
  descartadas: Descartada[];
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

/** Decide se a linha entra por si só, e com que destino. */
type Classificacao =
  | { entra: true; isTransfer: boolean; toAccount: string | null }
  | { entra: false; motivo: Motivo };

function classify(description: string, kind: "gasto" | "entrada", espaco: Espaco): Classificacao {
  if (POR_DECIDIR.test(description)) return { entra: false, motivo: "por decidir" };

  const t = classifyTransfer(description, kind, espaco);
  if (t === null) return { entra: true, isTransfer: false, toAccount: null };

  // A perna de entrada é o espelho de uma saída já registada no outro
  // extrato — guardar as duas contava o dinheiro a dobrar.
  if (t.leg === "entrada") return { entra: false, motivo: "espelho" };

  return { entra: true, isTransfer: true, toAccount: t.to };
}

/**
 * @param espaco qual das duas contabilidades está a receber este extrato — o
 *               mesmo texto do banco significa coisas diferentes conforme o livro.
 */
export function parseStatement(raw: string, espaco: Espaco = "pessoal"): ParseResult {
  const lines = raw.split(/\r?\n/);
  const isRevolut = /montante/i.test(raw) && /tipo/i.test(raw);

  const rows: ParsedRow[] = [];
  const descartadas: Descartada[] = [];

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

      const kind: ParsedRow["kind"] = montante < 0 ? "gasto" : "entrada";
      const base = { date, description: desc, amount: Math.abs(montante), kind };
      const c = classify(desc, kind, espaco);
      if (c.entra) rows.push({ ...base, isTransfer: c.isTransfer, toAccount: c.toAccount });
      else descartadas.push({ ...base, isTransfer: false, toAccount: null, motivo: c.motivo });
    }
    return { rows, format: "Revolut", descartadas };
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

    const kind: ParsedRow["kind"] = debito > 0 ? "gasto" : "entrada";
    const base = { date, description: desc, amount: debito > 0 ? debito : credito, kind };
    const c = classify(desc, kind, espaco);
    if (c.entra) rows.push({ ...base, isTransfer: c.isTransfer, toAccount: c.toAccount });
    else descartadas.push({ ...base, isTransfer: false, toAccount: null, motivo: c.motivo });
  }

  return { rows, format: looksCaixa ? "Caixa" : "desconhecido", descartadas };
}
