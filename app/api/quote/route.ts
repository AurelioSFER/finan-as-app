import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Vai buscar o preço de mercado (Yahoo Finance) e devolve já em EUR.
async function yahooPrice(symbol: string): Promise<{ price: number; currency: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return null;
    const j: any = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (price == null) return null;
    return { price: Number(price), currency: meta?.currency ?? "EUR" };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // taxa EUR/USD para converter posições em dólares
  const eur = await yahooPrice("EURUSD=X");
  const eurusd = eur?.price ?? 1.08;

  const quotes: Record<string, { price: number }> = {};
  for (const sym of symbols) {
    const y = sym.toUpperCase().endsWith(".US") ? sym.slice(0, -3) : sym;
    const q = await yahooPrice(y);
    if (!q) continue;
    let priceEur = q.price;
    if (q.currency === "USD") priceEur = q.price / eurusd;
    else if (q.currency === "GBp") priceEur = q.price / 100 / eurusd;
    else if (q.currency === "GBP") priceEur = q.price / eurusd;
    quotes[sym] = { price: priceEur };
  }

  return NextResponse.json({ quotes, eurusd });
}
