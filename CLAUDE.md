# DentIA — Contexto del proyecto para Claude Code

## Qué es esto
Asistente de IA por WhatsApp para clínicas dentales pequeñas y medianas (1-5 dentistas)
en Costa Rica. Automatiza recepción, agenda y captura de leads. MVP en construcción,
equipo de un solo desarrollador (Fabián), bootstrapped (<$50/mes).

## Stack decidido — no cambiar sin actualizar el ADR correspondiente
- Next.js 15 (App Router) + TypeScript + TailwindCSS + shadcn/ui
- Supabase (Postgres + Auth + RLS + Storage) — monolito full-stack en Next.js para el MVP
- Drizzle ORM
- Claude API — Haiku 4.5 como modelo primario, escalar a Sonnet 5 solo en casos ambiguos
- WhatsApp Business Cloud API (oficial, Meta) — nunca librerías no oficiales (Baileys, etc.)
- Google Calendar API para disponibilidad y creación de eventos
- Hosting: Vercel (frontend + API routes + webhook serverless)

## Estructura de carpetas (monolito modular por dominio)
/app → rutas y páginas
/lib/whatsapp → integración WhatsApp Cloud API
/lib/ai → orquestador + prompts de Claude
/lib/calendar → integración Google Calendar
/lib/clinics → lógica multi-tenant y configuración por clínica
/lib/db → esquema Drizzle, migraciones, queries

## Reglas de arquitectura no negociables
1. **La IA nunca escribe directo a la base de datos, al calendario ni ejecuta acciones
   irreversibles.** Claude solo devuelve una decisión estructurada (intención + entidades
   extraídas en JSON); el backend valida y ejecuta. Ninguna excepción.
2. **El bot nunca diagnostica, prescribe, ni interpreta síntomas.** Ante cualquier mención
   de dolor, sangrado, fiebre o urgencia médica: escalar a un humano, no responder.
3. **Aislamiento multi-tenant por `clinic_id` + Row Level Security en todas las tablas
   nuevas.** Ninguna tabla se crea sin su política RLS correspondiente.
4. **No confirmar una acción (cita creada/movida/cancelada) sin que el backend haya
   confirmado el resultado real** contra Google Calendar / Supabase.
5. **Nunca cancelar o reprogramar una cita sin confirmación explícita del paciente.**
6. Secretos solo en variables de entorno (Vercel/Supabase). Nunca en el repo, nunca
   hardcodeados, nunca en un `.env` commiteado.

## Alcance del MVP (no construir de más)
Sí: bot de WhatsApp (FAQs, agendar, confirmar, reprogramar, cancelar), clasificación de
intención, integración con Google Calendar, panel web mínimo (lista de leads/citas),
recordatorio 24h antes, escalamiento a humano, registro de conversaciones y consentimiento.

No todavía: CRM completo, seguimiento postconsulta, múltiples planes de precio, pagos
integrados, expediente clínico, multiidioma, app móvil, microservicios.

## Convenciones
- Componentes y funciones en inglés; textos de cara al usuario (UI, mensajes del bot) en
  español de Costa Rica.
- Commits pequeños y descriptivos. PRs por feature, no por archivo.
- Antes de cualquier cambio al esquema de base de datos: confirmar que la tabla tiene RLS.
- Antes de tocar el prompt del bot: revisar los guardrails de este archivo primero.

## Fuente de verdad
El roadmap completo, backlog y decisiones viven en `DentIA_Plan_de_Accion.xlsx`
(compartido con Daniel). Este archivo (`CLAUDE.md`) es el resumen técnico operativo —
si hay conflicto entre ambos, el Excel manda para negocio/prioridad, este archivo manda
para reglas de arquitectura.