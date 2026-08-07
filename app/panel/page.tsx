import { Bevan, Inter } from "next/font/google";
import Link from "next/link";
import { listConversationsForCurrentUser } from "@/lib/supabase/queries/conversations";
import { listMessagesForConversationAsCurrentUser } from "@/lib/supabase/queries/messages";
import { STATUS_LABEL, STATUS_STYLE, INTENT_LABEL, INTENT_STYLE } from "@/lib/ui/labels";
import { relativeTime } from "@/lib/utils/time";

const bevan = Bevan({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const allConversations = await listConversationsForCurrentUser();
  const selectedId = id ?? allConversations[0]?.id;
  const thread = selectedId ? await listMessagesForConversationAsCurrentUser(selectedId) : [];
  const selected = allConversations.find((c) => c.id === selectedId);

  return (
    <div className={`${inter.variable} ${bevan.variable} font-[family-name:var(--font-body)] h-screen bg-[#F7F5F1] flex text-[#1B2430]`}>
      <aside className="w-[360px] shrink-0 border-r border-[#E4E1D8] flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">🦷</span>
            <span className="font-[family-name:var(--font-display)] text-[19px] tracking-wide uppercase text-[#1F3B57]">DentIA</span>
          </div>
          <div className="mt-3 h-[3px] w-10 bg-[#C99A3B]" />
          <p className="mt-3 text-[11px] uppercase tracking-wide text-[#8A8778]">Conversaciones · {allConversations.length}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {allConversations.length === 0 && (
            <p className="px-6 py-8 text-sm text-[#8A8778]">
              Todavía no llegó ningún mensaje. En cuanto un paciente escriba por WhatsApp, va a aparecer acá.
            </p>
          )}
          {allConversations.map((c) => (
            <Link
              key={c.id}
              href={`/panel?id=${c.id}`}
              className={`block px-6 py-4 border-b border-[#EDEAE1] transition-colors border-l-2 ${
                c.id === selectedId ? "bg-[#EAF2F1] border-l-[#0E7C7B]" : "hover:bg-[#F1EFE8] border-l-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.phone}</span>
                <span className="text-[11px] text-[#8A8778]">{relativeTime(new Date(c.lastMessageAt))}</span>
              </div>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </Link>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-[#8A8778] text-sm">
            Seleccioná una conversación para ver los mensajes.
          </div>
        ) : (
          <>
            <header className="px-8 py-5 border-b border-[#E4E1D8] flex items-center justify-between bg-white">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[#1F3B57]">{selected.phone}</h1>
                <p className="text-[12px] text-[#8A8778] mt-0.5">Última actividad {relativeTime(new Date(selected.lastMessageAt))}</p>
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
                        ? "bg-[#0E7C7B] text-white rounded-br-sm"
                        : "bg-white border border-[#E4E1D8] text-[#1B2430] rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] text-[#B0AD9F]">{relativeTime(new Date(m.createdAt))}</span>
                    {m.detectedIntent && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${INTENT_STYLE[m.detectedIntent] ?? "bg-[#F1EFE8] text-[#5F5E5A]"}`}>
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