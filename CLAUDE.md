# DentIA — Contexto del proyecto para Claude Code

## Qué es esto
Asistente de IA por WhatsApp para clínicas dentales pequeñas y medianas (1-5 dentistas)
en Costa Rica. Automatiza recepción, agenda y captura de leads. MVP en construcción,
equipo de un solo desarrollador (Fabián), bootstrapped (<$50/mes).

## Stack decidido — no cambiar sin actualizar el ADR correspondiente
- Next.js 15 (App Router) + TypeScript + TailwindCSS
- Supabase (Postgres + Auth + RLS + Storage) — monolito full-stack en Next.js para el MVP
- Drizzle ORM
- Claude API — Haiku 4.5 como modelo primario para clasificación y extracción de datos
- WhatsApp Business Cloud API (oficial, Meta) — nunca librerías no oficiales (Baileys, etc.)
- Google Calendar API (OAuth) para disponibilidad y creación de eventos reales
- Hosting: Vercel (aún no desplegado — corriendo solo en local por ahora)

## Estructura de carpetas (monolito modular por dominio)
```
/app
  /panel                        → panel visual (inbox de conversaciones)
  /api/whatsapp/webhook         → recepción de mensajes de WhatsApp
  /api/auth/google/start        → inicia el flujo OAuth de Calendar
  /api/auth/google/callback     → recibe el resultado de OAuth y guarda tokens
  /api/google/test              → ruta de debug temporal, borrar cuando ya no se use
  /api/cron/send-reminders      → protegida por CRON_SECRET, dispara recordatorios 24h

/lib
  /whatsapp     → send.ts, types.ts, parseWebhookPayload.ts, replies.ts,
                  handleIncomingMessage.ts (orquestador), constants.ts
  /ai           → classify.ts (clasificación de intención), extractDate.ts
                  (extracción de fecha/motivo), constants.ts
  /google       → client.ts (OAuth), calendar.ts (lectura/creación de eventos),
                  availability.ts (cálculo de huecos libres), constants.ts
  /scheduling   → handleSchedulingTurn.ts (máquina de estados del flujo de agenda),
                  matchSlotSelection.ts (interpretación determinística, sin IA),
                  sendReminders.ts, constants.ts
  /db
    schema.ts, index.ts
    /queries    → conversations.ts, messages.ts, appointments.ts, patients.ts,
                  calendarIntegrations.ts — una función por operación, reusable
                  y testeable por separado de las rutas
  /ui           → labels.ts (labels/colores del panel)
  /utils        → time.ts (tiempo relativo)
  config.ts     → constantes compartidas (DEV_CLINIC_ID)
  env.ts        → requireEnv() — falla ruidoso si falta una variable de entorno
```

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
   hardcodeados, nunca en un `.env` commiteado. Nunca pegados en chats ni tickets.
7. **Interpretación determinística cuando es posible, IA solo cuando hace falta lenguaje
   natural real.** Ejemplo: elegir cuál horario de una lista ya ofrecida eligió el
   paciente (`matchSlotSelection.ts`) se resuelve con código simple, no con otra llamada
   a Claude — más barato, más rápido, más confiable contra una lista que ya conocemos.

## Alcance del MVP (no construir de más)
Sí: bot de WhatsApp (FAQs, agendar, confirmar, reprogramar, cancelar), clasificación de
intención, integración con Google Calendar, panel web mínimo (lista de leads/citas),
recordatorio 24h antes, escalamiento a humano, registro de conversaciones y consentimiento.

No todavía: CRM completo, seguimiento postconsulta, múltiples planes de precio, pagos
integrados, expediente clínico, multiidioma, app móvil, microservicios.

## Convenciones
- Componentes y funciones en inglés; textos de cara al usuario (UI, mensajes del bot) en
  español de Costa Rica.
- Commits en inglés, pequeños y descriptivos (ej. "Add appointment status enum", no
  "Agregar estado de citas"). PRs por feature, no por archivo.
- Antes de cualquier cambio al esquema de base de datos: confirmar que la tabla tiene RLS.
- Antes de tocar el prompt del bot: revisar los guardrails de este archivo primero.
- Toda fecha/hora mostrada al paciente debe especificar `timeZone: "America/Costa_Rica"`
  explícitamente (nunca confiar en la zona horaria del servidor — funciona distinto en
  local vs. producción; ya nos mordió una vez).
- Toda columna de fecha/hora usada en lógica real de tiempo (no solo registro histórico)
  debe declararse `timestamp(..., { withTimezone: true })` en el schema — sin esto, las
  comparaciones de fecha entre JS (UTC) y Postgres quedan ambiguas.
- Variables de entorno nuevas: usar `requireEnv()` de `lib/env.ts`, nunca
  `process.env.X!` a mano — así falla con un mensaje claro en vez de un `undefined`
  silencioso más adelante.

## Notas técnicas / lecciones aprendidas (evitar repetir estos errores)
- **Supabase + drizzle-kit**: el Transaction pooler (puerto 6543, usado en runtime vía
  `DATABASE_URL`) se cuelga con `drizzle-kit push`. Usar `DIRECT_DATABASE_URL` (Session
  pooler) solo para migraciones.
- **Claude a veces envuelve el JSON en \`\`\`json ... \`\`\`** aunque el prompt le pida
  JSON puro — `classify.ts` y `extractDate.ts` limpian esos backticks antes de parsear.
  Si se agregan más llamadas que esperan JSON, replicar ese cleanup.
- **`&&` vs `??` con strings vacíos**: `"" && x` devuelve `""`, y `?? fallback` NO
  reemplaza un string vacío (solo `null`/`undefined`). Usar condicionales explícitos
  (`if`/ternario) en vez de encadenar `&&` y `??` cuando el valor intermedio puede ser
  un string vacío.
- **dotenv en `drizzle.config.ts`**: `dotenv/config` busca `.env` por defecto, no
  `.env.local`. Hay que apuntarlo explícitamente: `config({ path: ".env.local" })`.

## Cuentas externas
Todas separadas de la cuenta personal de Fabián; identidad de negocio `dentia.cr@gmail.com`
donde aplica (mismo patrón en cada proveedor: cuenta/organización propia de DentIA, no
mezclada con cuentas personales).

- **GitHub**: repo privado `fabian-astorga/dentia`
- **Supabase**: organización "DentIA", proyecto `dentia-dev`
- **Meta for Developers**: Business Portfolio "DentIA", app `DentIA Dev`, número de
  WhatsApp de prueba conectado. Token de acceso generado vía System User (`dentia-bot`),
  válido 60 días desde su generación — **revisar fecha de expiración periódicamente**,
  no hay alerta automática todavía.
- **Anthropic Console**: cuenta `dentia.cr@gmail.com`, API key activa con crédito cargado
- **Google Cloud**: proyecto `DentIA Dev` bajo `dentia.cr@gmail.com`. OAuth consent
  screen en modo "Prueba" (no verificado por Google todavía — límite de 100 test users,
  actualmente 2 agregados). Calendario de prueba: uno dedicado llamado "DentIA" dentro
  de la cuenta de prueba, guardado como `google_calendar_id: primary` en
  `calendar_integrations` (es el calendario principal de esa cuenta, solo renombrado).
- **Vercel**: cuenta creada, proyecto aún no conectado/desplegado.

## Estado actual del proyecto
Circuito funcionando de punta a punta en local (probado con WhatsApp real):

```
WhatsApp → Meta → webhook → Claude clasifica intención
                                  ↓
                    ¿agendar? → extrae fecha/motivo → Google Calendar (disponibilidad real)
                                  ↓
                    paciente elige horario → crea evento real + guarda en `appointments`
                                  ↓
                         confirma por WhatsApp
```

Completado:
- Webhook de WhatsApp (recepción + verificación de Meta)
- Clasificación de intención con Claude (`faq` / `agendar_cita` / `caso_especial`),
  fail-safe hacia `caso_especial` si algo falla al parsear
- Flujo completo de agendar cita con memoria conversacional (`conversations.context`
  como máquina de estados: `collecting_date` → `awaiting_slot_selection` → cierre)
- Integración real con Google Calendar (OAuth, lectura de disponibilidad, creación de
  eventos)
- Recordatorio 24h antes (`/api/cron/send-reminders`, protegido con `CRON_SECRET`,
  disparado manualmente por ahora — falta programarlo en Vercel Cron cuando se despliegue)
- Panel visual (`/panel`) — inbox de conversaciones, sin login todavía, consulta la
  base directo server-side. Paleta: navy `#1F3B57`, teal `#0E7C7B`, coral `#D85A30`.
  Tipografía: Bevan (wordmark/títulos) + Inter (todo lo funcional/denso)

Pendiente (en orden sugerido, sin urgencia crítica salvo que se indique):
- Reprogramar y cancelar citas (el MVP las incluye, todavía no están construidas)
- Notificación real al staff cuando hay un `caso_especial` (hoy solo responde al
  paciente, no avisa a nadie de la clínica)
- Login del panel con Supabase Auth (hoy cualquiera con la URL ve las conversaciones)
- Deploy a Vercel + configurar Vercel Cron para los recordatorios
- Borrar `/api/google/test` cuando ya no se necesite para debug
- Fusionar `classify.ts` y `extractDate.ts` en una sola llamada a Claude (optimización
  de costo/latencia, no urgente)

## Fuente de verdad
El roadmap completo, backlog y decisiones viven en `DentIA_Plan_de_Accion.xlsx`
(compartido con Daniel). Este archivo (`CLAUDE.md`) es el resumen técnico operativo —
si hay conflicto entre ambos, el Excel manda para negocio/prioridad, este archivo manda
para reglas de arquitectura.