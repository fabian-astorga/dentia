import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-brand-surface rounded-xl border border-brand-border p-8">
        <div className="mb-1">
          <Logo />
        </div>
        <p className="text-sm text-brand-muted mb-6 mt-3">
          Ingresá tu correo y te mandamos un enlace para entrar al panel.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}