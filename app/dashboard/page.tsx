import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Dashboard from "./Dashboard";
import type { Expense } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const space = cookies().get("space")?.value === "conjunta" ? "conjunta" : "pessoal";

  const { data } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <Dashboard key={space} rows={(data as Expense[]) ?? []} space={space} />
      <BottomNav />
    </div>
  );
}
