"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Fund = { id: string; value: number; goal: number | null } | null;
export type Entry = { id: string; date: string; amount: number; note: string | null };

function eur2(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function eur0(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function parseNum(s: string) {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}
function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function EmergencyFund({
  fund,
  transfers,
  initialEntries,
}: {
  fund: Fund;
  transfers: number;
  initialEntries: Entry[];
}) {
  const supabase = createClient();
  const [id, setId] = useState<string | null>(fund?.id ?? null);
  const [base, setBase] = useState<number>(fund?.value ?? 0);
  const [goal, setGoal] = useState<number>(fund?.goal ?? 5000);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);

  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addDate, setAddDate] = useState(todayISO());
  const [addNote, setAddNote] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBase, setEditBase] = useState("");
  const [editGoal, setEditGoal] = useState("");

  const entriesSum = entries.reduce((a, e) => a + e.amount, 0);
  const total = base + transfers + entriesSum;
  const pct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  const falta = Math.max(0, goal - total);

  function flashOk() {
    setOk(true);
    setTimeout(() => setOk(false), 2500);
  }

  async function persist(b: number, g: number) {
    setSaving(true);
    setError(null);
    let err = null;
    if (id) {
      const res = await supabase.from("holdings").update({ value: b, goal: g, updated_at: new Date().toISOString() }).eq("id", id);
      err = res.error;
    } else {
      const res = await supabase
        .from("holdings")
        .insert({ name: "Fundo de emergência", kind: "fundo_emergencia", value: b, goal: g })
        .select("id")
        .single();
      err = res.error;
      if (!err && res.data) setId(res.data.id);
    }
    setSaving(false);
    if (err) setError(err.message);
    else flashOk();
  }

  async function quickAdd() {
    const amt = parseNum(addAmount);
    if (amt <= 0) return;
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("fund_entries")
      .insert({ date: addDate, amount: amt, note: addNote.trim() || null })
      .select("id, date, amount, note")
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setEntries((prev) => [data as Entry, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    setAddOpen(false);
    setAddAmount("");
    setAddNote("");
    setAddDate(todayISO());
    flashOk();
  }

  async function removeEntry(eid: string) {
    const prev = entries;
    setEntries((e) => e.filter((x) => x.id !== eid));
    const { error } = await supabase.from("fund_entries").delete().eq("id", eid);
    if (error) {
      setError(error.message);
      setEntries(prev);
    }
  }

  function openEdit() {
    setEditBase(base ? base.toString().replace(".", ",") : "");
    setEditGoal(goal ? goal.toString().replace(".", ",") : "");
    setEditOpen(true);
  }
  async function saveEdit() {
    const b = parseNum(editBase);
    const g = parseNum(editGoal);
    setBase(b);
    setGoal(g);
    setEditOpen(false);
    await persist(b, g);
  }

  return (
    <>
      {/* Total + progresso */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600 }}>
          <span className="sec-ic">🛟</span> Total do fundo
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
          <div className="num" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", color: "var(--warn)" }}>
            {eur2(total)}
          </div>
          <button
            onClick={() => setAddOpen((o) => !o)}
            title="Adicionar juros ou depósito"
            aria-label="Adicionar juros ou depósito"
            style={{
              width: 40, height: 40, flexShrink: 0, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "var(--accent-soft)", color: "var(--accent-2)", fontSize: 24, fontWeight: 700, lineHeight: 1,
            }}
          >
            +
          </button>
        </div>

        {addOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <div className="field">
              <label>Valor €</label>
              <input className="input" inputMode="decimal" placeholder="ex: 8,50" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Data</label>
              <input className="input" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Nota (opcional)</label>
              <input className="input" placeholder="ex: juros Trade Republic" value={addNote} onChange={(e) => setAddNote(e.target.value)} />
            </div>
            <div style={{ gridColumn: "span 2", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={quickAdd} disabled={!addAmount || saving}>
                Adicionar
              </button>
              <button className="btn" onClick={() => { setAddOpen(false); setAddAmount(""); setAddNote(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="muted" style={{ fontSize: 13.5, margin: "12px 0 14px" }}>
          {pct}% da meta de {eur0(goal)}
          {falta > 0 ? ` · faltam ${eur2(falta)}` : " · meta atingida! 🎉"}
          {ok && <span style={{ color: "var(--good)", fontWeight: 700, marginLeft: 8 }}>Guardado ✓</span>}
          {error && <span style={{ color: "var(--bad)", marginLeft: 8 }}>{error}</span>}
        </div>

        <div style={{ height: 12, borderRadius: 8, background: "var(--surface-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--warn)", borderRadius: 8, transition: "width .3s ease" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13, flexWrap: "wrap", gap: 4 }}>
          <span className="muted">Base: <b style={{ color: "var(--ink)" }}>{eur2(base)}</b></span>
          <span className="muted">+ {eur2(entriesSum)} juros/depósitos</span>
          <span className="muted">+ {eur2(transfers)} transferências</span>
        </div>
      </div>

      {/* Histórico de juros/depósitos */}
      {entries.length > 0 && (
        <>
          <div className="section-title">Juros e depósitos</div>
          <div className="card mov-list">
            {entries.map((e) => (
              <div className="mov-row" key={e.id}>
                <span className="ic" style={{ background: "rgba(255,169,77,.16)" }}>💰</span>
                <div className="mid">
                  <div className="t">{e.note || "Depósito"}</div>
                  <div className="s">{e.date.slice(8, 10)}/{e.date.slice(5, 7)}/{e.date.slice(0, 4)}</div>
                </div>
                <span className="amount-in">+{eur2(e.amount)}</span>
                <button className="btn btn-ghost" title="Apagar" onClick={() => removeEntry(e.id)} style={{ marginLeft: 8 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Editar (escondido por defeito) */}
      <div style={{ marginTop: 14 }}>
        {!editOpen ? (
          <button className="btn btn-ghost" onClick={openEdit}>
            ⚙️ Editar valor base / meta
          </button>
        ) : (
          <div className="card" style={{ padding: 18 }}>
            <div className="grid-form">
              <div className="field span-3">
                <label>Valor base €</label>
                <input className="input" inputMode="decimal" value={editBase} onChange={(e) => setEditBase(e.target.value)} placeholder="ex: 2835,96" />
              </div>
              <div className="field span-3">
                <label>Meta €</label>
                <input className="input" inputMode="decimal" value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="ex: 5000" />
              </div>
              <div className="field span-6" style={{ flexDirection: "row", gap: 12 }}>
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                  {saving ? "…" : "Guardar"}
                </button>
                <button className="btn" onClick={() => setEditOpen(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
