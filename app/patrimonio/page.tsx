import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import EmergencyFund, { type Fund, type Entry } from "./EmergencyFund";
import Investments, { type Position } from "./Investments";

export const dynamic = "force-dynamic";

export default async function PatrimonioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const space = cookies().get("space")?.value === "conjunta" ? "conjunta" : "pessoal";

  const { data: h } = await supabase.from("holdings").select("id, value, goal").eq("kind", "fundo_emergencia").limit(1);
  const fund = (h?.[0] as Fund) ?? null;

  const { data: exp } = await supabase
    .from("expenses")
    .select("amount")
    .eq("kind", "gasto")
    .eq("category", "Fundo emergência");
  const transfers = (exp ?? []).reduce((a, r) => a + Number(r.amount), 0);

  const { data: fe } = await supabase.from("fund_entries").select("id, date, amount, note").order("date", { ascending: false });
  const entries = (fe ?? []) as Entry[];

  const { data: inv } = await supabase
    .from("holdings")
    .select("id, name, ticker, quantity, invested, value")
    .eq("kind", "investimento")
    .order("value", { ascending: false });
  const investments: Position[] = (inv ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    ticker: p.ticker,
    quantity: p.quantity == null ? null : Number(p.quantity),
    invested: p.invested == null ? null : Number(p.invested),
    value: Number(p.value),
  }));

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <h1 className="page">Património</h1>
      <p className="muted" style={{ marginBottom: 18 }}>Fundo de emergência e investimentos.</p>

      <div className="section-title" style={{ marginTop: 6 }}>🛟 Fundo de emergência</div>
      <EmergencyFund fund={fund} transfers={transfers} initialEntries={entries} />

      <Investments initial={investments} />

      <BottomNav />
    </div>
  );
}
