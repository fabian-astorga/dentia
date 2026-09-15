"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function PanelHeader({ clinicName }: { clinicName: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/panel/login");
  }

  return (
    <header className="h-[52px] shrink-0 border-b border-brand-border flex items-center justify-between px-4 bg-brand-surface">
      <Logo />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 hover:bg-brand-hover rounded-lg px-2 py-1 transition-colors"
        >
          <span className="text-[12px] text-brand-muted">{clinicName}</span>
          <span className="w-[26px] h-[26px] rounded-full bg-brand-primary-soft flex items-center justify-center text-brand-heading text-[11px] font-medium">
            {initials(clinicName) || "?"}
          </span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-56 bg-brand-surface border border-brand-border rounded-xl shadow-lg py-2 z-20">
            <p className="px-3 py-1.5 text-[11px] text-brand-muted uppercase tracking-wide">{clinicName}</p>

            <div
              title="Disponible próximamente"
              className="flex items-center justify-between gap-2 px-3 py-2 cursor-default"
            >
              <span className="flex items-center gap-2 text-[13px] text-brand-muted">
                <i className="ti ti-credit-card text-base" />
                Pago y facturación
              </span>
              <span className="flex items-center gap-1 text-[10px] font-medium bg-brand-accent/15 text-brand-accent px-2 py-0.5 rounded-full">
                <i className="ti ti-lock text-[9px]" />
                Pronto
              </span>
            </div>

            <div className="h-px bg-brand-divider my-1.5" />

            <button
              onClick={handleSignOut}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] text-brand-text hover:bg-brand-hover"
            >
              <i className="ti ti-logout text-base" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}