"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-brand-text">
        Listo — revisá tu correo (<strong>{email}</strong>) y hacé click en el
        enlace para entrar. Podés cerrar esta pestaña.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        required
        placeholder="tu@clinica.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border border-brand-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="bg-brand-primary hover:bg-brand-primary-hover transition-colors text-white rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {status === "sending" ? "Enviando..." : "Enviar enlace"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600">
          Algo falló. Probá de nuevo en un momento.
        </p>
      )}
    </form>
  );
}