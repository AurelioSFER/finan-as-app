import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Plano from "./Plano";
import type { Expense } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function PlanoPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const space = cookies().get("space")?.value === "conjunta" ? "conjunta" : "pessoal";

  const { data: exp } = await supabase.from("expenses").select("*").order("date", { ascending: false });
  const { data: bud } = await supabase.from("budgets").select("key, planned");

  const prefix = space + ":";
  const budgets: Record<string, number> = {};
  (bud ?? []).forEach((b: { key: string; planned: number }) => {
    if (b.key.startsWith(prefix)) budgets[b.key.slice(prefix.length)] = Number(b.planned);
  });

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <h1 className="page">Plano</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Define o teu orçamento (Planeado) e a app mostra-te o <b>Real</b> dos teus dados, lado a lado.
      </p>
      <Plano key={space} rows={(exp as Expense[]) ?? []} budgets={budgets} space={space} />
      <BottomNav />
    </div>
  );
}
