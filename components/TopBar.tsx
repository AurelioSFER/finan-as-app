"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SpaceSwitcher from "./SpaceSwitcher";

export default function TopBar({ email, space }: { email?: string | null; space: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const name = email ? email.split("@")[0] : "Bem-vindo";
  const nameCap = name.charAt(0).toUpperCase() + name.slice(1);
  const initial = (email?.[0] ?? "?").toUpperCase();

  return (
    <>
      <div className="topbar">
        <div className="avatar">{initial}</div>
        <div className="greet">
          Olá 👋
          <b>{nameCap}</b>
        </div>

        <nav className="nav-links" style={{ marginLeft: 24 }}>
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}>Início</Link>
          <Link href="/expenses" className={pathname === "/expenses" ? "active" : ""}>Gastos</Link>
          <Link href="/plano" className={pathname === "/plano" ? "active" : ""}>Plano</Link>
          <Link href="/objetivos" className={pathname === "/objetivos" ? "active" : ""}>Objetivos</Link>
          <Link href="/patrimonio" className={pathname === "/patrimonio" ? "active" : ""}>Património</Link>
          <Link href="/import" className={pathname === "/import" ? "active" : ""}>Importar</Link>
        </nav>

        <button className="btn btn-ghost" onClick={logout}>
          Sair
        </button>
      </div>

      <div style={{ margin: "0 0 18px" }}>
        <SpaceSwitcher space={space} />
      </div>
    </>
  );
}
