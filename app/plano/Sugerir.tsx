"use client";

import { useMemo, useState } from "react";
import type { Expense } from "@/lib/categories";
import { RUBRICAS, type Extra, type Rubrica } from "@/lib/plan";
import { analisar, sugerir, type Sugestao } from "@/lib/planSuggest";

/** Despesas pontuais que costumam aparecer, já com a rubrica onde caem. */
const ATALHOS: { label: string; rubrica: Rubrica }[] = [
  { label: "Férias", rubrica: "Supérfluos" },
  { label: "Viagem", rubrica: "Supérfluos" },
  { label: "Prendas", rubrica: "Supérfluos" },
  { label: "Seguro", rubrica: "Fixos" },
  { label: "IUC", rubrica: "Fixos" },
  { label: "Saúde", rubrica: "Necessários" },
];

function eur(n: number) {
  return "€" + n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function parseNum(s: string) {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

export default function Sugerir({
  rows,
  month,
  label,
  extrasIniciais,
  onApply,
  onClose,
}: {
  rows: Expense[];
  month: string;
  label: string;
  extrasIniciais: Extra[];
  onApply: (s: Sugestao, extras: Extra[]) => Promise<void>;
  onClose: () => void;
}) {
  const analise = useMemo(() => analisar(rows, month), [rows, month]);

  const [extras, setExtras] = useState<Extra[]>(extrasIniciais);
  const [rendimento, setRendimento] = useState<string>(
    String(Math.round(analise.rendimentoDoMes || analise.rendimento.mediana))
  );
  const [saving, setSaving] = useState(false);

  const proposta = useMemo(
    () => sugerir(analise, extras, parseNum(rendimento)),
    [analise, extras, rendimento]
  );

  function addExtra(label: string, rubrica: Rubrica) {
    setExtras((e) => [...e, { label, amount: 0, rubrica }]);
  }
  function updExtra(i: number, patch: Partial<Extra>) {
    setExtras((e) => e.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function rmExtra(i: number) {
    setExtras((e) => e.filter((_, idx) => idx !== i));
  }

  async function aplicar() {
    setSaving(true);
    await onApply(proposta, extras.filter((e) => e.label.trim() && e.amount > 0));
    setSaving(false);
  }

  if (analise.meses.length === 0) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <p style={{ margin: "0 0 10px", fontWeight: 700 }}>Ainda não há meses anteriores para analisar.</p>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13.5 }}>
          Importa pelo menos um mês de extrato antes de {label} e eu consigo propor um plano com base no que gastaste.
        </p>
        <button className="btn" onClick={onClose}>Fechar</button>
      </div>
    );
  }

  const de = analise.meses[0];
  const ate = analise.meses[analise.meses.length - 1];
  const total = proposta.Fixos + proposta.Necessários + proposta.Supérfluos;

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-.01em" }}>Plano sugerido para {label}</div>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 16px" }}>
        Analisei {analise.meses.length} {analise.meses.length === 1 ? "mês" : "meses"} ({de} a {ate}) e fiquei com a
        mediana de cada rubrica — assim um mês fora do normal não estraga o plano.
      </p>

      {/* Pergunta 1 — rendimento */}
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Quanto contas receber em {label}?</label>
        <input
          className="input"
          inputMode="decimal"
          value={rendimento}
          onChange={(e) => setRendimento(e.target.value)}
        />
        <span className="muted" style={{ fontSize: 12.5 }}>
          {analise.rendimentoDoMes > 0
            ? `Já tens ${eur(analise.rendimentoDoMes)} de entradas importadas neste mês.`
            : `Ainda não há entradas em ${label}. Isto é a mediana dos meses anteriores (${eur(analise.rendimento.mediana)}).`}
        </span>
      </div>

      {/* Pergunta 2 — despesas fora do normal */}
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Este mês tens alguma despesa fora do normal?</label>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Férias, um seguro, uma viagem, prendas. Somo ao que já é hábito gastares.
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {ATALHOS.map((a) => (
          <button key={a.label} className="btn" onClick={() => addExtra(a.label, a.rubrica)}>
            + {a.label}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => addExtra("", "Supérfluos")}>
          + outra
        </button>
      </div>

      {extras.map((e, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px auto",
            gap: 8,
            alignItems: "center",
            padding: 10,
            marginBottom: 8,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--surface-2)",
          }}
        >
          <input
            className="input"
            placeholder="ex: Férias no Algarve"
            aria-label="Nome da despesa"
            value={e.label}
            onChange={(ev) => updExtra(i, { label: ev.target.value })}
          />
          <input
            className="input"
            inputMode="decimal"
            placeholder="0"
            aria-label="Valor"
            value={e.amount === 0 ? "" : String(e.amount)}
            onChange={(ev) => updExtra(i, { amount: parseNum(ev.target.value) })}
          />
          <button className="btn btn-ghost" aria-label="Remover" onClick={() => rmExtra(i)}>
            ✕
          </button>
          <select
            className="select"
            aria-label="Rubrica"
            style={{ gridColumn: "1 / -1" }}
            value={e.rubrica}
            onChange={(ev) => updExtra(i, { rubrica: ev.target.value as Rubrica })}
          >
            {RUBRICAS.map((r) => (
              <option key={r} value={r}>
                Conta como {r}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Proposta */}
      <div className="section-title" style={{ margin: "20px 4px 10px" }}>A proposta</div>
      {(["Fixos", "Necessários", "Supérfluos"] as Rubrica[]).map((k) => {
        const s = analise.rubricas[k];
        const ex = extras.filter((e) => e.rubrica === k).reduce((a, e) => a + e.amount, 0);
        return (
          <div key={k} className="cat-row" style={{ padding: "9px 0" }}>
            <span className="name">
              {k}
              <div className="muted" style={{ fontSize: 12 }}>
                mediana {eur(s.mediana)}
                {s.min !== s.max && <> · entre {eur(s.min)} e {eur(s.max)}</>}
                {ex > 0 && <> · +{eur(ex)} de extras</>}
              </div>
            </span>
            <span className="amt num" style={{ fontSize: 15 }}>{eur(proposta[k])}</span>
          </div>
        );
      })}
      <div className="cat-row" style={{ padding: "9px 0", borderTop: "1px solid var(--line)" }}>
        <span className="name" style={{ fontWeight: 800 }}>
          Sobra para poupar
          <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
            {eur(proposta.rendimento)} de rendimento − {eur(total)} de gastos
          </div>
        </span>
        <span
          className="amt num"
          style={{ fontSize: 17, color: proposta.Poupança > 0 ? "var(--good)" : "var(--bad)" }}
        >
          {eur(proposta.Poupança)}
        </span>
      </div>

      {proposta.Poupança === 0 && (
        <div className="error" style={{ marginTop: 12 }}>
          Com estes números não sobra nada para poupar. Corta nos Supérfluos ou adia alguma das despesas extra.
        </div>
      )}

      {analise.porClassificar.mediana > 0 && (
        <div className="notice" style={{ marginTop: 12 }}>
          Há cerca de {eur(analise.porClassificar.mediana)}/mês em <b>Outros</b>, que não entram em nenhuma rubrica.
          Arruma essas categorias nos Gastos para o plano ficar fiável.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={aplicar} disabled={saving}>
          {saving ? "A guardar…" : `Aplicar a ${label}`}
        </button>
        <button className="btn" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
