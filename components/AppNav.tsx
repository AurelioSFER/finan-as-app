"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppNav({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="brand">
          Finanças <span>&amp;</span>
        </div>
        <div className="nav-links">
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}>
            Dashboard
          </Link>
          <Link href="/expenses" className={pathname === "/expenses" ? "active" : ""}>
            Gastos
          </Link>
        </div>
        <div className="nav-right">
          {email && <span className="num">{email}</span>}
          <button className="btn btn-ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
