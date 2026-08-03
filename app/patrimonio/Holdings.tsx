"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Holding = {
  id: string;
  name: string;
  kind: "investimento" | "fundo_emergencia";
  platform: string | null;
  value: number;
  goal: number | null;
};

function eur(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function parseNum(s: string) {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

const emptyForm = { name: "", kind: "investimento", platform: "", value: "", goal: "" };

export default function Holdings({ initial }: { initial: Holding[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Holding[]>(initial);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const fundo = rows.filter((r) => r.kind === "fundo_emergencia");
  const invest = rows.filter((r) => r.kind === "investimento");
  const fundoValue = fundo.reduce((a, r) => a + r.value, 0);
  const fundoGoal = fundo.reduce((a, r) => a + (r.goal ?? 0), 0);
  const investValue = invest.reduce((a, r) => a + r.value, 0);
  const total = fundoValue + investValue;
  const pct = fundoGoal > 0 ? Math.min(100, Math.round((fundoValue / fundoGoal) * 100)) : 0;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Dá um nome (ex: XTB — S&P500).");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      platform: form.platform.trim() || null,
      value: parseNum(form.value),
      goal: form.goal ? parseNum(form.goal) : null,
    };
    const { data, error } = await supabase.from("holdings").insert(payload).select().single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setRows((prev) => [...prev, data as Holding]);
    setForm({ ...emptyForm });
    setShowAdd(false);
  }

  async function saveValue(row: Holding, raw: string) {
    const value = parseNum(raw);
    if (value === row.value) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, value } : r)));
    await supabase.from("holdings").update({ value, updated_at: new Date().toISOString() }).eq("id", row.id);
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
      {/* Resumo */}
      <div className="tiles" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="tile">
          <div className="label">Património total</div>
          <div className="big num">{eur(total)}</div>
        </div>
        <div className="tile">
          <div className="label">Fundo emergência</div>
          <div className="big num" style={{ color: "var(--warn)" }}>{eur(fundoValue)}</div>
          {fundoGoal > 0 && <div className="sub">{pct}% de {eur(fundoGoal)}</div>}
        </div>
        <div className="tile">
          <div className="label">Investido</div>
          <div className="big num" style={{ color: "var(--good)" }}>{eur(investValue)}</div>
        </div>
      </div>

      {/* Fundo de emergência */}
      <div className="section-title">🛟 Fundo de emergência</div>
      <div className="card" style={{ padding: 18 }}>
        {fundoGoal > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
              <span className="muted">{eur(fundoValue)} de {eur(fundoGoal)}</span>
              <span style={{ fontWeight: 700, color: "var(--warn)" }}>{pct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 8, background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--warn)", borderRadius: 8 }} />
            </div>
          </>
        )}
        <div style={{ marginTop: fundoGoal > 0 ? 14 : 0 }}>
          {fundo.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Adiciona o teu fundo de emergência abaixo (ex: Trade Republic).</p>
          ) : (
            fundo.map((r) => (
              <HoldingRow key={r.id} row={r} onSave={saveValue} onRemove={remove} />
            ))
          )}
        </div>
      </div>

      {/* Investimentos */}
      <div className="section-title">📈 Investimentos</div>
      <div className="card" style={{ padding: 18 }}>
        {invest.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Adiciona as tuas posições abaixo (ex: XTB — S&amp;P500).</p>
        ) : (
          invest.map((r) => <HoldingRow key={r.id} row={r} onSave={saveValue} onRemove={remove} />)
        )}
      </div>

      {/* Adicionar */}
      <div style={{ marginTop: 16 }}>
        {!showAdd ? (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Adicionar posição
          </button>
        ) : (
          <div className="card" style={{ padding: 18 }}>
            <form onSubmit={add} className="grid-form">
              <div className="field span-3">
                <label>Nome</label>
                <input className="input" placeholder="Ex: XTB — S&P500" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="field span-3">
                <label>Tipo</label>
                <select className="select" value={form.kind} onChange={(e) => set("kind", e.target.value)}>
                  <option value="investimento">Investimento</option>
                  <option value="fundo_emergencia">Fundo de emergência</option>
                </select>
              </div>
              <div className="field span-2">
                <label>Plataforma</label>
                <input className="input" placeholder="XTB, Trade Republic…" value={form.platform} onChange={(e) => set("platform", e.target.value)} />
              </div>
              <div className="field span-2">
                <label>Valor (€)</label>
                <input className="input" inputMode="decimal" placeholder="0" value={form.value} onChange={(e) => set("value", e.target.value)} />
              </div>
              <div className="field span-2">
                <label>Meta (€) — opcional</label>
                <input className="input" inputMode="decimal" placeholder="ex: 5000" value={form.goal} onChange={(e) => set("goal", e.target.value)} />
              </div>
              {error && <div className="error span-6">{error}</div>}
              <div className="field span-6" style={{ flexDirection: "row", gap: 10 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "…" : "Guardar"}
                </button>
                <button className="btn" type="button" onClick={() => setShowAdd(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

function HoldingRow({
  row,
  onSave,
  onRemove,
}: {
  row: Holding;
  onSave: (r: Holding, v: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="mov-row" style={{ padding: "12px 4px" }}>
      <div className="mid">
        <div className="t">{row.name}</div>
        {row.platform && <div className="s">{row.platform}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="muted" style={{ fontSize: 14 }}>€</span>
        <input
          className="input"
          style={{ width: 100, textAlign: "right", padding: "8px 10px" }}
          inputMode="decimal"
          defaultValue={row.value.toString().replace(".", ",")}
          onBlur={(e) => onSave(row, e.target.value)}
        />
        <button className="btn btn-ghost" title="Apagar" onClick={() => onRemove(row.id)}>
          ✕
        </button>
      </div>
    </div>
  );
}
