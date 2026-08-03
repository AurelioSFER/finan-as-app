import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Expenses from "./Expenses";
import type { Expense } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const space = cookies().get("space")?.value === "conjunta" ? "conjunta" : "pessoal";

  const { data } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: g } = await supabase
    .from("goals")
    .select("name")
    .eq("space", space)
    .eq("done", false)
    .order("sort", { ascending: true });
  const goals = (g ?? []).map((r: { name: string }) => r.name);

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <h1 className="page">Gastos</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Importa o extrato do banco e ajusta as categorias aqui — a memória vai aprendendo.
      </p>
      <Expenses key={space} initial={(data as Expense[]) ?? []} space={space} goals={goals} />
      <BottomNav />
    </div>
  );
}
