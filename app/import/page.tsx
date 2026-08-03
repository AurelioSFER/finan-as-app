import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Import from "./Import";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const space = cookies().get("space")?.value === "conjunta" ? "conjunta" : "pessoal";
  const defaultAccount = space === "conjunta" ? "Conjunta" : "Caixa";

  const { data } = await supabase.from("merchant_rules").select("key,category");
  const rules: Record<string, string> = {};
  (data ?? []).forEach((r: { key: string; category: string }) => {
    rules[r.key] = r.category;
  });

  return (
    <div className="container">
      <TopBar email={user?.email} space={space} />
      <h1 className="page">Importar extrato</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Cola o Excel/CSV do banco (Caixa ou Revolut). Eu leio, adivinho as categorias pela memória, e tu confirmas.
      </p>
      <Import rules={rules} defaultAccount={defaultAccount} />
      <BottomNav />
    </div>
  );
}
