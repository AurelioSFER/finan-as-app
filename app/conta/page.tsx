import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MudarPassword from "./MudarPassword";

export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const space = cookies().get("space")?.value === "conjunta" ? "conjunta" : "pessoal";

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <h1 className="page">Conta</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Sessão aberta como <b>{user?.email}</b>.
      </p>

      <MudarPassword />

      <BottomNav />
    </div>
  );
}
