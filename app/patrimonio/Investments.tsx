"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Position = {
  id: string;
  name: string;
  ticker: string | null;
  quantity: number | null;
  invested: number | null;
  value: number;
};

function eur2(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseNum(s: string) {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

export default function Investments({ initial }: { initial: Position[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Position[]>(initial);
  const [quotes, setQuotes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", ticker: "", value: "", gain: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQuotes(list: Position[]) {
    const syms = Array.from(new Set(list.map((r) => r.ticker).filter(Boolean))) as string[];
    if (!syms.length) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/quote?symbols=${encodeURIComponent(syms.join(","))}`);
      const j = await r.json();
      const q: Record<string, number> = {};
      Object.entries((j.quotes ?? {}) as Record<string, { price: number }>).forEach(([k, v]) => {
        q[k] = v.price;
      });
      setQuotes(q);
    } catch {
      /* mantém valores manuais */
    }
    setLoading(false);
  }

  useEffect(() => {
    loadQuotes(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function liveValue(p: Position): number {
    if (p.ticker && p.quantity && quotes[p.ticker]) return p.quantity * quotes[p.ticker];
    return p.value;
  }

  const total = rows.reduce((a, p) => a + liveValue(p), 0);
  const investedTotal = rows.reduce((a, p) => a + (p.invested ?? p.value), 0);
  const gain = total - investedTotal;
  const gainPct = investedTotal > 0 ? (gain / investedTotal) * 100 : 0;

  async function insertPositions(items: { name: string; ticker: string | null; value: number; gain: number }[]) {
    const syms = items.map((i) => i.ticker).filter(Boolean) as string[];
    let priceMap: Record<string, number> = {};
    if (syms.length) {
      try {
        const r = await fetch(`/api/quote?symbols=${encodeURIComponent(syms.join(","))}`);
        const j = await r.json();
        Object.entries((j.quotes ?? {}) as Record<string, { price: number }>).forEach(([k, v]) => {
          priceMap[k] = v.price;
        });
      } catch {}
    }
    const payload = items.map((i) => {
      const invested = i.gain ? i.value / (1 + i.gain / 100) : i.value;
      const price = i.ticker ? priceMap[i.ticker] : undefined;
      const quantity = price ? i.value / price : null;
      return { name: i.name, kind: "investimento", platform: "XTB", ticker: i.ticker, quantity, invested, value: i.value };
    });
    const { data, error } = await supabase.from("holdings").insert(payload).select("id, name, ticker, quantity, invested, value");
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      const np = [...rows, ...(data as Position[])];
      setRows(np);
      loadQuotes(np);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = parseNum(form.value);
    if (!form.name.trim() || value <= 0) {
      setError("Preenche o nome e o valor.");
      return;
    }
    setSaving(true);
    setError(null);
    await insertPositions([{ name: form.name.trim(), ticker: form.ticker.trim() || null, value, gain: parseNum(form.gain) }]);
    setSaving(false);
    setForm({ name: "", ticker: "", value: "", gain: "" });
    setShowAdd(false);
  }

  async function seedXTB() {
    setSaving(true);
    setError(null);
    await insertPositions([
      { name: "Core S&P500", ticker: "SXR8.DE", value: 2050.07, gain: 20.02 },
      { name: "Nasdaq 100", ticker: "NQSE.DE", value: 569, gain: -5 },
      { name: "Tesla", ticker: "TSLA.US", value: 307.71, gain: -21 },
    ]);
    setSaving(false);
  }

  async function remove(id: string) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase.from("holdings").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setRows(prev);
    }
  }

  return (
    <>
      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        📈 Investimentos
        <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => loadQuotes(rows)} disabled={loading}>
          {loading ? "…" : "↻ atualizar preços"}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <div className="chip">
            <div className="k">Valor atual</div>
            <div className="v num">{eur2(total)}</div>
          </div>
          <div className="chip">
            <div className="k">Investido</div>
            <div className="v num">{eur2(investedTotal)}</div>
          </div>
          <div className="chip">
            <div className="k">Ganho/Perda</div>
            <div className="v num" style={{ color: gain >= 0 ? "var(--good)" : "var(--bad)" }}>
              {gain >= 0 ? "+" : "−"}
              {gainPct.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      <div className="card mov-list">
        {rows.length === 0 ? (
          <div style={{ padding: 18, textAlign: "center" }}>
            <p className="muted" style={{ margin: "0 0 12px" }}>Sem posições ainda.</p>
            <button className="btn btn-primary" onClick={seedXTB} disabled={saving}>
              {saving ? "…" : "Adicionar as minhas 3 posições XTB"}
            </button>
          </div>
        ) : (
          rows.map((p) => {
            const val = liveValue(p);
            const inv = p.invested ?? p.value;
            const g = val - inv;
            const gp = inv > 0 ? (g / inv) * 100 : 0;
            const live = p.ticker && p.quantity && quotes[p.ticker];
            return (
              <div className="mov-row" key={p.id}>
                <span className="ic" style={{ background: "rgba(124,107,255,.16)" }}>📈</span>
                <div className="mid">
                  <div className="t">{p.name}</div>
                  <div className="s">
                    {p.ticker ?? "manual"}
                    {live ? " · ao vivo" : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontWeight: 800 }}>{eur2(val)}</div>
                  <div className="num" style={{ fontSize: 12.5, fontWeight: 700, color: g >= 0 ? "var(--good)" : "var(--bad)" }}>
                    {g >= 0 ? "+" : "−"}
                    {gp.toFixed(1)}%
                  </div>
                </div>
                <button className="btn btn-ghost" title="Apagar" onClick={() => remove(p.id)} style={{ marginLeft: 6 }}>
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}

      {/* Adicionar posição */}
      <div style={{ marginTop: 14 }}>
        {!showAdd ? (
          rows.length > 0 && (
            <button className="btn" onClick={() => setShowAdd(true)}>
              + Adicionar posição
            </button>
          )
        ) : (
          <div className="card" style={{ padding: 18 }}>
            <form onSubmit={add} className="grid-form">
              <div className="field span-3">
                <label>Nome</label>
                <input className="input" placeholder="Ex: Core S&P500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field span-3">
                <label>Ticker (símbolo)</label>
                <input className="input" placeholder="SXR8.DE, TSLA.US…" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
              </div>
              <div className="field span-3">
                <label>Valor atual (€)</label>
                <input className="input" inputMode="decimal" placeholder="2050,07" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="field span-3">
                <label>Ganho (%) — opcional</label>
                <input className="input" inputMode="decimal" placeholder="ex: 20 ou -5" value={form.gain} onChange={(e) => setForm({ ...form, gain: e.target.value })} />
              </div>
              <div className="field span-6" style={{ flexDirection: "row", gap: 12 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "…" : "Guardar"}
                </button>
                <button className="btn" type="button" onClick={() => setShowAdd(false)}>
                  Cancelar
                </button>
              </div>
            </form>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              Com o <b>ticker</b>, a app vai buscar o preço e atualiza o valor sozinha. Sem ticker, fica o valor manual.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
