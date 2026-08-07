import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-[#E4E1D8] p-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg leading-none">🦷</span>
          <span className="font-semibold text-[19px] tracking-wide uppercase text-[#1F3B57]">
            DentIA
          </span>
        </div>
        <p className="text-sm text-[#8A8778] mb-6">
          Ingresá tu correo y te mandamos un enlace para entrar al panel.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}