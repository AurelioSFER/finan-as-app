"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** O Supabase recusa abaixo de 6; pedimos 8 para não ficar pela mínima. */
const MINIMO = 8;

export default function MudarPassword() {
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (nova !== confirmar) {
      setError("As duas palavras-passe não são iguais.");
      return;
    }
    if (nova.length < MINIMO) {
      setError(`Usa pelo menos ${MINIMO} caracteres.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: nova });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setNova("");
    setConfirmar("");
    setOk(true);
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 460 }}>
      <div className="section-title" style={{ marginTop: 0 }}>
        <span className="sec-ic">🔑</span> Mudar palavra-passe
      </div>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field">
          <label htmlFor="nova">Nova palavra-passe</label>
          <input
            id="nova"
            className="input"
            type="password"
            required
            minLength={MINIMO}
            autoComplete="new-password"
            placeholder={`mínimo ${MINIMO} caracteres`}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirmar">Outra vez, para confirmar</label>
          <input
            id="confirmar"
            className="input"
            type="password"
            required
            minLength={MINIMO}
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </div>

        {error && <div className="error">{error}</div>}
        {ok && <div className="notice">✅ Palavra-passe alterada. Continuas com a sessão aberta aqui.</div>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "A guardar…" : "Guardar palavra-passe"}
        </button>
      </form>
    </div>
  );
}
