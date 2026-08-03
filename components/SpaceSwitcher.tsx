"use client";

import { useRouter } from "next/navigation";

export default function SpaceSwitcher({ space }: { space: string }) {
  const router = useRouter();

  function set(s: string) {
    document.cookie = `space=${s}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="space-switch">
      <button className={space === "pessoal" ? "active" : ""} onClick={() => set("pessoal")}>
        👤 Pessoal
      </button>
      <button className={space === "conjunta" ? "active" : ""} onClick={() => set("conjunta")}>
        👥 Conjunta
      </button>
    </div>
  );
}
