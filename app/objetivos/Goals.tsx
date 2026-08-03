"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Capacity } from "@/lib/plan";

export type Source = "manual" | "fundo" | "investimentos";
export type Goal = {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  deadline: string | null;
  source: Source;
  note: string | null;
  done: boolean;
  sort: number;
};

const SOURCES: { value: Source; label: string }[] = [
  { value: "manual", label: "Manual (eu vou somando)" },
  { value: "fundo", label: "Fundo de emergência (automático)" },
  { value: "investimentos", label: "Investimentos (automático)" },
];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
/** Meses (arredondados para cima, mínimo 0) entre hoje e uma data ISO. */
function monthsUntil(iso: string): number {
  const now = new Date(todayISO());
  const end = new Date(iso);
  const m = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  const adj = end.getDate() >= now.getDate() ? m : m - 1;
  return Math.max(0, adj);
}
/** Etiqueta "Mar 2027" para daqui a N meses. */
function monthsAhead(n: number): string {
  const d = new Date(todayISO());
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
function dateLabel(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
function plural(n: number) {
  return n === 1 ? "mês" : "meses";
}

/** O que o plano reserva por mês para cada objetivo.
 *  - `prazo`: tem data marcada (ex: um crédito), a mensalidade sai da data.
 *  - `plano`: sem data, vive do que sobra do plano — daí sai a data prevista.
 *  - `sem-verba`: o plano não deixa nada para ele.
 *  - `longe`: a esse ritmo demorava mais de 20 anos; a data não diz nada de útil. */
type Alloc =
  | { kind: "atingido" }
  | { kind: "prazo"; perMonth: number; meses: number; expirado: boolean }
  | { kind: "plano"; perMonth: number; meses: number; eta: string; espera: number }
  | { kind: "longe"; perMonth: number }
  | { kind: "sem-verba"; motivo: "prazos" | "plano" };

const MAX_MESES = 240;

export default function Goals({
  initial,
  space,
  autoFundo,
  autoInvest,
  pace,
  plan,
}: {
  initial: Goal[];
  space: string;
  autoFundo: number;
  autoInvest: number;
  pace: number;
  plan: Capacity;
}) {
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    emoji: "🎯",
    name: "",
    target: "",
    saved: "",
    deadline: "",
    source: "manual" as Source,
    note: "",
  });

  function savedOf(g: Goal): number {
    if (g.source === "fundo") return autoFundo;
    if (g.source === "investimentos") return autoInvest;
    return g.saved;
  }

  const active = goals.filter((g) => !g.done);
  const totals = useMemo(() => {
    const target = active.reduce((a, g) => a + g.target, 0);
    const saved = active.reduce((a, g) => a + Math.min(savedOf(g), g.target || savedOf(g)), 0);
    return { target, saved, pct: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, autoFundo, autoInvest]);

  // ---- Repartição do plano pelos objetivos.
  // Quem tem data marcada serve-se primeiro: o prazo é um compromisso, a
  // mensalidade é o que ele obriga. O resto do plano vai para os objetivos sem
  // data, um de cada vez pela ordem da lista — juntar para dois ao mesmo tempo
  // só atrasa os dois.
  const alloc = useMemo(() => {
    const ativos = goals.filter((g) => !g.done);
    const map = new Map<string, Alloc>();
    let comprometido = 0;

    for (const g of ativos) {
      const falta = Math.max(0, g.target - savedOf(g));
      if (falta <= 0) {
        map.set(g.id, { kind: "atingido" });
        continue;
      }
      if (!g.deadline) continue;
      const meses = monthsUntil(g.deadline);
      const perMonth = meses > 0 ? falta / meses : falta;
      comprometido += perMonth;
      map.set(g.id, { kind: "prazo", perMonth, meses, expirado: meses <= 0 });
    }

    const livre = Math.max(0, plan.total - comprometido);

    let espera = 0;
    for (const g of ativos) {
      if (g.deadline || map.has(g.id)) continue;
      const falta = Math.max(0, g.target - savedOf(g));
      if (livre <= 0) {
        map.set(g.id, { kind: "sem-verba", motivo: comprometido > 0 ? "prazos" : "plano" });
        continue;
      }
      const meses = Math.ceil(falta / livre);
      if (espera + meses > MAX_MESES) {
        map.set(g.id, { kind: "longe", perMonth: livre });
        espera = MAX_MESES + 1; // o que vier a seguir a este está ainda mais longe
        continue;
      }
      map.set(g.id, { kind: "plano", perMonth: livre, meses, eta: monthsAhead(espera + meses), espera });
      espera += meses;
    }

    return { map, comprometido, livre, excede: Math.max(0, comprometido - plan.total) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, autoFundo, autoInvest, plan]);

  function resetForm() {
    setForm({ emoji: "🎯", name: "", target: "", saved: "", deadline: "", source: "manual", note: "" });
  }

  async function createGoal(preset?: Partial<Goal>) {
    const payload = preset
      ? {
          name: preset.name ?? "Novo objetivo",
          emoji: preset.emoji ?? "🎯",
          target: preset.target ?? 0,
          saved: preset.saved ?? 0,
          deadline: preset.deadline ?? null,
          source: preset.source ?? "manual",
          note: preset.note ?? null,
          space,
        }
      : {
          name: form.name.trim(),
          emoji: form.emoji.trim() || "🎯",
          target: parseNum(form.target),
          saved: form.source === "manual" ? parseNum(form.saved) : 0,
          deadline: form.deadline || null,
          source: form.source,
          note: form.note.trim() || null,
          space,
        };
    if (!payload.name || payload.target <= 0) {
      setError("Dá um nome e um valor-alvo ao objetivo.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("goals")
      .insert(payload)
      .select("id, name, emoji, target, saved, deadline, source, note, done, sort")
      .single();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      setGoals((prev) => [
        ...prev,
        { ...(data as any), target: Number(data.target), saved: Number(data.saved), sort: data.sort ?? 0 },
      ]);
    }
    setNewOpen(false);
    resetForm();
  }

  async function patch(id: string, fields: Partial<Goal>) {
    const prev = goals;
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...fields } : g)));
    const { error } = await supabase
      .from("goals")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setError(error.message);
      setGoals(prev);
    }
  }

  async function removeGoal(id: string) {
    const prev = goals;
    setGoals((gs) => gs.filter((g) => g.id !== id));
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) {
      setError(error.message);
      setGoals(prev);
    }
  }

  async function quickAdd(g: Goal) {
    const amt = parseNum(addAmount);
    if (amt === 0) return;
    await patch(g.id, { saved: Math.max(0, g.saved + amt) });
    setAddingTo(null);
    setAddAmount("");
  }

  return (
    <>
      {error && (
        <div className="error" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Resumo */}
      {active.length > 0 && (
        <div className="card" style={{ padding: 22, marginBottom: 4 }}>
          <div style={{ color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600 }}>
            <span className="sec-ic">🎯</span> Poupado para objetivos
          </div>
          <div className="num" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>
            {eur2(totals.saved)}
          </div>
          <div className="muted" style={{ fontSize: 13.5, margin: "8px 0 12px" }}>
            {totals.pct}% de {eur0(totals.target)} em {active.length} objetivo{active.length > 1 ? "s" : ""}
            {pace > 0 && <> · ritmo atual {eur0(pace)}/mês</>}
          </div>
          <div style={{ height: 12, borderRadius: 8, background: "var(--surface-2)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${totals.pct}%`,
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                borderRadius: 8,
                transition: "width .3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* O que o plano dá por mês */}
      <div className="card" style={{ padding: 18, marginTop: 12 }}>
        <div style={{ color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600 }}>
          <span className="sec-ic">📋</span> O teu plano dá, por mês
        </div>
        <div className="num" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>
          {eur0(plan.total)}
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          Poupança planeada {eur0(plan.poupanca)}
          {plan.sobra !== 0 && <> · sobra do orçamento {plan.sobra > 0 ? "+" : "−"}{eur0(Math.abs(plan.sobra))}</>}
        </div>

        <div className="chips" style={{ marginTop: 14 }}>
          <div className="chip">
            <div className="k">Preso a prazos</div>
            <div className="v num">{eur0(alloc.comprometido)}</div>
          </div>
          <div className="chip">
            <div className="k">Livre</div>
            <div className="v num" style={{ color: alloc.livre > 0 ? "var(--good)" : "var(--ink-2)" }}>
              {eur0(alloc.livre)}
            </div>
          </div>
          <div className="chip">
            <div className="k">Ritmo real</div>
            <div className="v num">{eur0(pace)}</div>
          </div>
        </div>

        {plan.total <= 0 ? (
          <div className="notice" style={{ marginTop: 12 }}>
            O teu plano não deixa nada para poupar. Vai ao <Link href="/plano"><b>Plano</b></Link> e sobe a Poupança (ou
            corta nos gastos planeados) para os objetivos ganharem datas.
          </div>
        ) : (
          alloc.excede > 0 && (
            <div className="error" style={{ marginTop: 12 }}>
              Os prazos que marcaste pedem {eur0(alloc.comprometido)}/mês e o plano só dá {eur0(plan.total)}. Faltam{" "}
              <b>{eur0(alloc.excede)}/mês</b> — alarga um prazo ou ajusta o <Link href="/plano"><b>Plano</b></Link>.
            </div>
          )
        )}

        <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          Os objetivos com prazo servem-se primeiro. O que sobra vai para os objetivos sem prazo, um de cada vez, pela
          ordem desta lista.
        </p>
      </div>

      {/* Lista */}
      <div className="section-title">Os teus objetivos</div>

      {goals.length === 0 && (
        <div className="card" style={{ padding: 22 }}>
          <p style={{ margin: "0 0 14px", fontSize: 14.5 }}>Ainda não tens objetivos. Começa pelos dois do plano:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                createGoal({ name: "Fundo de emergência", emoji: "🛟", target: 5000, source: "fundo" })
              }
            >
              🛟 Fundo €5.000
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => createGoal({ name: "Tesla Model 3", emoji: "🚗", target: 20000, source: "manual" })}
            >
              🚗 Tesla €20.000
            </button>
          </div>
        </div>
      )}

      {goals.map((g) => {
        const saved = savedOf(g);
        const pct = g.target > 0 ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
        const falta = Math.max(0, g.target - saved);
        const etaMeses = pace > 0 && falta > 0 ? Math.ceil(falta / pace) : null;
        const atingido = falta <= 0;
        const auto = g.source !== "manual";
        const editing = editingId === g.id;
        const a = alloc.map.get(g.id);

        return (
          <div key={g.id} className="card" style={{ padding: 18, marginBottom: 12, opacity: g.done ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <span className="ic" style={{ background: "var(--accent-soft)" }}>{g.emoji}</span>
              <div className="mid" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{g.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {eur2(saved)} de {eur0(g.target)}
                  {auto && <> · automático</>}
                </div>
              </div>
              <div className="num" style={{ fontWeight: 800, fontSize: 18, color: atingido ? "var(--good)" : "var(--accent-2)" }}>
                {pct}%
              </div>
            </div>

            <div style={{ height: 10, borderRadius: 8, background: "var(--surface-2)", overflow: "hidden", margin: "14px 0 10px" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: atingido ? "var(--good)" : "linear-gradient(90deg, var(--accent), var(--accent-2))",
                  borderRadius: 8,
                  transition: "width .3s ease",
                }}
              />
            </div>

            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {atingido ? (
                <b style={{ color: "var(--good)" }}>Meta atingida! 🎉</b>
              ) : (
                <>
                  <div>
                    Faltam <b style={{ color: "var(--ink)" }}>{eur2(falta)}</b>
                  </div>

                  {a?.kind === "prazo" && (
                    <div>
                      Prazo {dateLabel(g.deadline!)}
                      {a.expirado ? (
                        <> — <span style={{ color: "var(--bad)", fontWeight: 700 }}>prazo esgotado</span>, tens de pôr</>
                      ) : (
                        <> ({a.meses} {plural(a.meses)}) → tens de pôr</>
                      )}{" "}
                      <b style={{ color: "var(--ink)" }}>{eur0(a.perMonth)}/mês</b> de lado
                      {alloc.excede > 0 ? (
                        <span style={{ color: "var(--bad)", fontWeight: 700 }}> ✗ não cabe no plano</span>
                      ) : (
                        <span style={{ color: "var(--good)", fontWeight: 700 }}> ✓ cabe no plano</span>
                      )}
                    </div>
                  )}

                  {a?.kind === "plano" && (
                    <div>
                      O plano liberta <b style={{ color: "var(--ink)" }}>{eur0(a.perMonth)}/mês</b> para aqui → meta em{" "}
                      <b style={{ color: "var(--accent-2)" }}>{a.eta}</b> ({a.meses} {plural(a.meses)} a poupar)
                      {a.espera > 0 && (
                        <> — só arranca daqui a {a.espera} {plural(a.espera)}, quando os objetivos acima fecharem</>
                      )}
                    </div>
                  )}

                  {a?.kind === "longe" && (
                    <div style={{ color: "var(--bad)" }}>
                      A {eur0(a.perMonth)}/mês isto leva mais de 20 anos. Sobe a Poupança no{" "}
                      <Link href="/plano"><b>Plano</b></Link> ou baixa o valor-alvo.
                    </div>
                  )}

                  {a?.kind === "sem-verba" && (
                    <div style={{ color: "var(--bad)" }}>
                      {a.motivo === "prazos" ? (
                        <>
                          Fica à espera: os objetivos com prazo já levam {eur0(alloc.comprometido)}/mês, todo o teu
                          plano. Só arranca quando algum deles fechar.
                        </>
                      ) : (
                        <>
                          O plano não deixa nada por mês para poupar. Sobe a Poupança no{" "}
                          <Link href="/plano"><b>Plano</b></Link>.
                        </>
                      )}
                    </div>
                  )}

                  {etaMeses !== null && (
                    <div>
                      Ao ritmo real ({eur0(pace)}/mês) chegavas lá em{" "}
                      <b style={{ color: "var(--ink)" }}>{monthsAhead(etaMeses)}</b>
                    </div>
                  )}
                </>
              )}
              {g.note && <div style={{ marginTop: 4 }}>{g.note}</div>}
            </div>

            {/* Ações */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {!auto && !g.done && (
                <button className="btn" onClick={() => { setAddingTo(addingTo === g.id ? null : g.id); setAddAmount(""); }}>
                  + Adicionar
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setEditingId(editing ? null : g.id)}>
                ⚙️ Editar
              </button>
              <button className="btn btn-ghost" onClick={() => patch(g.id, { done: !g.done })}>
                {g.done ? "↩︎ Reabrir" : "✓ Concluir"}
              </button>
              <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => removeGoal(g.id)}>
                ✕
              </button>
            </div>

            {addingTo === g.id && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Quanto puseste de lado? €</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="ex: 150"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary" onClick={() => quickAdd(g)} disabled={!addAmount}>
                  Somar
                </button>
              </div>
            )}

            {editing && (
              <div className="grid-form" style={{ marginTop: 14 }}>
                <div className="field span-3">
                  <label>Nome</label>
                  <input className="input" defaultValue={g.name} onBlur={(e) => patch(g.id, { name: e.target.value })} />
                </div>
                <div className="field span-3">
                  <label>Valor-alvo €</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    defaultValue={String(g.target).replace(".", ",")}
                    onBlur={(e) => patch(g.id, { target: parseNum(e.target.value) })}
                  />
                </div>
                <div className="field span-3">
                  <label>Poupado €</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    disabled={auto}
                    defaultValue={auto ? "" : String(g.saved).replace(".", ",")}
                    placeholder={auto ? "vem do Património" : ""}
                    onBlur={(e) => patch(g.id, { saved: parseNum(e.target.value) })}
                  />
                </div>
                <div className="field span-3">
                  <label>Prazo — vazio = calculado pelo plano</label>
                  <input
                    className="input"
                    type="date"
                    defaultValue={g.deadline ?? ""}
                    onBlur={(e) => patch(g.id, { deadline: e.target.value || null })}
                  />
                </div>
                <div className="field span-3">
                  <label>Emoji</label>
                  <input className="input" defaultValue={g.emoji} onBlur={(e) => patch(g.id, { emoji: e.target.value || "🎯" })} />
                </div>
                <div className="field span-3">
                  <label>Origem do poupado</label>
                  <select
                    className="select"
                    defaultValue={g.source}
                    onChange={(e) => patch(g.id, { source: e.target.value as Source })}
                  >
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field span-6">
                  <label>Nota</label>
                  <input className="input" defaultValue={g.note ?? ""} onBlur={(e) => patch(g.id, { note: e.target.value || null })} />
                </div>
                <div className="field span-6">
                  <button className="btn" onClick={() => setEditingId(null)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Novo objetivo */}
      <div style={{ marginTop: 14 }}>
        {!newOpen ? (
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
            + Novo objetivo
          </button>
        ) : (
          <div className="card" style={{ padding: 18 }}>
            <div className="grid-form">
              <div className="field span-3">
                <label>Nome</label>
                <input className="input" placeholder="ex: Tesla Model 3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className="field span-3">
                <label>Emoji</label>
                <input className="input" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
              </div>
              <div className="field span-3">
                <label>Valor-alvo €</label>
                <input className="input" inputMode="decimal" placeholder="ex: 20000" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              </div>
              <div className="field span-3">
                <label>Já poupado €</label>
                <input className="input" inputMode="decimal" placeholder="0" disabled={form.source !== "manual"} value={form.saved} onChange={(e) => setForm({ ...form, saved: e.target.value })} />
              </div>
              <div className="field span-3">
                <label>Prazo — vazio = calculado pelo plano</label>
                <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div className="field span-3">
                <label>Origem do poupado</label>
                <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as Source })}>
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="field span-6">
                <label>Nota (opcional)</label>
                <input className="input" placeholder="ex: vender o gasóleo ~€14k + crédito mínimo" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="field span-6" style={{ flexDirection: "row", gap: 12 }}>
                <button className="btn btn-primary" onClick={() => createGoal()} disabled={busy}>
                  {busy ? "…" : "Criar objetivo"}
                </button>
                <button className="btn" onClick={() => { setNewOpen(false); resetForm(); setError(null); }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
