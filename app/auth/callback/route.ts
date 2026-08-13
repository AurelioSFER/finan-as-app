import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recebe o link mágico, troca o code por sessão e segue para o dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Um link de recuperação abre sessão mas ainda não trocou a palavra-passe:
  // vai direito ao sítio onde ela se muda, senão a pessoa cai no dashboard
  // e fica sem perceber onde é que havia de a escrever.
  const recuperacao = searchParams.get("type") === "recovery";
  const next = searchParams.get("next") ?? (recuperacao ? "/conta" : "/dashboard");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
