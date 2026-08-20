import Link from "next/link";
import { Logo } from "@/components/Logo";
import { UpcomingFeatures } from "@/components/UpcomingFeatures";
import { listConversationsForCurrentUser } from "@/lib/supabase/queries/conversations";
import { listMessagesForConversationAsCurrentUser } from "@/lib/supabase/queries/messages";
import { STATUS_LABEL, STATUS_STYLE, INTENT_LABEL, INTENT_STYLE } from "@/lib/ui/labels";
import { relativeTime } from "@/lib/utils/time";

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const allConversations = await listConversationsForCurrentUser();
  const selectedId = id ?? allConversations[0]?.id;
  const thread = selectedId ? await listMessagesForConversationAsCurrentUser(selectedId) : [];
  const selected = allConversations.find((c) => c.id === selectedId);

  return (
    <div className="h-screen bg-brand-bg flex text-brand-text">
      <aside className="w-[360px] shrink-0 border-r border-brand-border flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <Logo />
          <div className="mt-3 h-[3px] w-10 bg-brand-accent" />
          <p className="mt-3 text-[11px] uppercase tracking-wide text-brand-muted">Conversaciones · {allConversations.length}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {allConversations.length === 0 && (
            <p className="px-6 py-8 text-sm text-brand-muted">
              Todavía no llegó ningún mensaje. En cuanto un paciente escriba por WhatsApp, va a aparecer acá.
            </p>
          )}
          {allConversations.map((c) => (
            <Link
              key={c.id}
              href={`/panel?id=${c.id}`}
              className={`block px-6 py-4 border-b border-brand-divider transition-colors border-l-2 ${
                c.id === selectedId ? "bg-brand-primary-soft border-l-brand-primary" : "hover:bg-brand-hover border-l-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.phone}</span>
                <span className="text-[11px] text-brand-muted">{relativeTime(new Date(c.lastMessageAt))}</span>
              </div>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </Link>
          ))}
        </div>
        <UpcomingFeatures />
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-brand-muted text-sm">
            Seleccioná una conversación para ver los mensajes.
          </div>
        ) : (
          <>
            <header className="px-8 py-5 border-b border-brand-border flex items-center justify-between bg-brand-surface">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-lg tracking-wide text-brand-heading">{selected.phone}</h1>
                <p className="text-[12px] text-brand-muted mt-0.5">Última actividad {relativeTime(new Date(selected.lastMessageAt))}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[12px] font-medium ${STATUS_STYLE[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>
            </header>
            <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-4">
              {thread.map((m) => (
                <div key={m.id} className={`max-w-[70%] flex flex-col gap-1 ${m.direction === "outbound" ? "self-end items-end" : "self-start items-start"}`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.direction === "outbound"
                        ? "bg-brand-primary text-white rounded-br-sm"
                        : "bg-brand-surface border border-brand-border text-brand-text rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-brand-faint">{relativeTime(new Date(m.createdAt))}</span>
                    {m.detectedIntent && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${INTENT_STYLE[m.detectedIntent] ?? "bg-status-neutral-bg text-status-neutral-text"}`}>
                        {INTENT_LABEL[m.detectedIntent] ?? m.detectedIntent}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}