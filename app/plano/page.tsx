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
  const budgetRows = (bud ?? []).map((b: { key: string; planned: number }) => ({
    key: b.key,
    planned: Number(b.planned),
  }));

  // o mês corrente vem daqui para o servidor e o cliente renderizarem o mesmo
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <h1 className="page">Plano</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Um plano por mês. Carrega em <b>Sugerir plano</b> e eu analiso os meses anteriores, pergunto-te o que muda
        neste, e proponho os números.
      </p>
      <Plano key={space} rows={(exp as Expense[]) ?? []} budgetRows={budgetRows} space={space} today={today} />
      <BottomNav />
    </div>
  );
}
