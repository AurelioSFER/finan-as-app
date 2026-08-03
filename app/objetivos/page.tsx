import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { SAVINGS_CATEGORIES } from "@/lib/categories";
import { parseBudgetRows, planCapacity, planForMonth } from "@/lib/plan";
import Goals, { type Goal } from "./Goals";

export const dynamic = "force-dynamic";

export default async function ObjetivosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const space = cookies().get("space")?.value === "conjunta" ? "conjunta" : "pessoal";

  const { data: g } = await supabase
    .from("goals")
    .select("id, name, emoji, target, saved, deadline, source, note, done, sort")
    .eq("space", space)
    .order("done", { ascending: true })
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  const goals: Goal[] = (g ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    target: Number(r.target),
    saved: Number(r.saved),
    deadline: r.deadline,
    source: r.source,
    note: r.note,
    done: r.done,
    sort: r.sort ?? 0,
  }));

  // ---- Poupado automático: fundo de emergência (mesma conta da página Património)
  const { data: h } = await supabase.from("holdings").select("value").eq("kind", "fundo_emergencia").limit(1);
  const { data: fe } = await supabase.from("fund_entries").select("amount");
  const { data: fundExp } = await supabase
    .from("expenses")
    .select("amount")
    .eq("kind", "gasto")
    .eq("category", "Fundo emergência");
  const autoFundo =
    Number(h?.[0]?.value ?? 0) +
    (fe ?? []).reduce((a, r: any) => a + Number(r.amount), 0) +
    (fundExp ?? []).reduce((a, r: any) => a + Number(r.amount), 0);

  // ---- Poupado automático: investimentos
  const { data: inv } = await supabase.from("holdings").select("value").eq("kind", "investimento");
  const autoInvest = (inv ?? []).reduce((a, r: any) => a + Number(r.value), 0);

  // ---- Ritmo: média mensal do que foi para poupança/investimento neste espaço
  const { data: sav } = await supabase
    .from("expenses")
    .select("date, amount, category, account, flag")
    .eq("kind", "gasto")
    .in("category", SAVINGS_CATEGORIES);
  const rows = (sav ?? []).filter((r: any) =>
    space === "conjunta" ? r.account === "Conjunta" : r.account !== "Conjunta"
  );
  const byMonth = new Map<string, number>();
  for (const r of rows as any[]) {
    if (r.flag === "R") continue;
    const m = String(r.date).slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + Number(r.amount));
  }
  const pace = byMonth.size ? [...byMonth.values()].reduce((a, b) => a + b, 0) / byMonth.size : 0;

  // ---- Orçamento planeado (página Plano): é ele que define quanto há por mês para objetivos.
  // Usa o plano em vigor no mês corrente.
  const { data: bud } = await supabase.from("budgets").select("key, planned");
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const parsed = parseBudgetRows(
    (bud ?? []).map((b: { key: string; planned: number }) => ({ key: b.key, planned: Number(b.planned) })),
    space
  );
  const plan = planCapacity(planForMonth(space, mesAtual, parsed));

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <h1 className="page">Objetivos</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Metas de poupança calculadas a partir do teu Plano: quanto pões de lado por mês e quando lá chegas.
      </p>

      <Goals initial={goals} space={space} autoFundo={autoFundo} autoInvest={autoInvest} pace={pace} plan={plan} />

      <BottomNav />
    </div>
  );
}
