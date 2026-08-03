"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const p = usePathname();
  return (
    <div className="bottomnav">
      <Link href="/dashboard" className={p === "/dashboard" ? "active" : ""}>
        <span className="ni">🏠</span>
        Início
      </Link>
      <Link href="/expenses" className={p === "/expenses" ? "active" : ""}>
        <span className="ni">🧾</span>
        Gastos
      </Link>
      <Link href="/import" aria-label="Importar extrato">
        <span className="fab">+</span>
      </Link>
      <Link href="/plano" className={p === "/plano" ? "active" : ""}>
        <span className="ni">📋</span>
        Plano
      </Link>
      <Link href="/objetivos" className={p === "/objetivos" ? "active" : ""}>
        <span className="ni">🎯</span>
        Objetivos
      </Link>
      <Link href="/patrimonio" className={p === "/patrimonio" ? "active" : ""}>
        <span className="ni">💼</span>
        Património
      </Link>
    </div>
  );
}
