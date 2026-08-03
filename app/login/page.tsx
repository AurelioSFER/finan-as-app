"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      // Sem sessão => a confirmação de email está ligada no Supabase.
      setInfo("Conta criada! Se o Supabase pedir confirmação por email, confirma. Senão, entra já abaixo.");
      setMode("signin");
      setLoading(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>
          Finanças <span>&amp;</span>
        </h1>
        <p className="muted" style={{ marginBottom: 22 }}>
          Aurélio &amp; Francisca — o vosso registo de gastos.
        </p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Palavra-passe</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={6}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="error">{error}</div>}
          {info && <div className="notice">{info}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "…" : isSignup ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="muted" style={{ fontSize: 13, textAlign: "center", marginTop: 16 }}>
          {isSignup ? "Já tens conta?" : "Primeira vez?"}{" "}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "2px 6px", color: "var(--accent-2)" }}
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              setError(null);
              setInfo(null);
            }}
          >
            {isSignup ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </div>
    </div>
  );
}
