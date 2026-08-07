# DentIA — Contexto del proyecto para Claude Code

## Qué es esto
Asistente de IA por WhatsApp para clínicas dentales pequeñas y medianas (1-5 dentistas)
en Costa Rica. Automatiza recepción, agenda y captura de leads. MVP en construcción,
equipo de un solo desarrollador (Fabián), bootstrapped (<$50/mes).

## Stack decidido — no cambiar sin actualizar el ADR correspondiente
- Next.js 16 (App Router) + TypeScript + TailwindCSS
- Supabase (Postgres + Auth + RLS + Storage) — monolito full-stack en Next.js para el MVP
- Drizzle ORM (backend, bypassa RLS a propósito) + `@supabase/ssr` (panel, respeta RLS)
- Claude API — Haiku 4.5 como modelo primario para clasificación y extracción de datos
- WhatsApp Business Cloud API (oficial, Meta) — nunca librerías no oficiales (Baileys, etc.)
- Google Calendar API (OAuth) para disponibilidad y creación de eventos reales
- Hosting: Vercel (aún no desplegado — corriendo solo en local por ahora)

## Estructura de carpetas (monolito modular por dominio)
```
/app
  /panel                        → panel visual (inbox de conversaciones), CON login
    /login                      → login por magic link (page.tsx + LoginForm.tsx)
  /auth/callback                → intercambia el ?code= del magic link por una sesión
  /api/whatsapp/webhook         → recepción de mensajes de WhatsApp
  /api/auth/google/start        → inicia el flujo OAuth de Calendar
  /api/auth/google/callback     → recibe el resultado de OAuth y guarda tokens
  /api/google/test              → ruta de debug temporal, borrar cuando ya no se use
  /api/cron/send-reminders      → protegida por CRON_SECRET, dispara recordatorios 24h

middleware.ts                   → protege /panel/*, redirige a /panel/login sin sesión

/lib
  /whatsapp     → send.ts, types.ts, parseWebhookPayload.ts (incluye
                  extractPhoneNumberId), replies.ts, handleIncomingMessage.ts
                  (orquestador — recibe clinicId explícito, ya no hardcodeado),
                  isGreeting.ts (detección determinística de saludos, sin IA), constants.ts
  /ai           → classify.ts (clasificación de intención; exporta Intent y
                  DetectedIntent = Intent | "saludo"), extractDate.ts, generateReply.ts
                  (sistema de tono; incluye situación "greeting"),
                  interpretSchedulingIntent.ts, constants.ts
  /google       → client.ts (OAuth), calendar.ts (lectura/creación de eventos),
                  availability.ts (cálculo de huecos libres), constants.ts
  /scheduling   → handleSchedulingTurn.ts (máquina de estados del flujo de agenda),
                  matchSlotSelection.ts, matchAppointmentByText.ts, isAffirmative.ts,
                  format.ts, sendReminders.ts, constants.ts
  /notifications → notifyStaff.ts
  /db
    schema.ts, index.ts
    whatsappIntegrations.ts     → getClinicIdByPhoneNumberId() — resuelve clínica por
                                   phone_number_id de Meta, usado por el webhook
    /queries    → conversations.ts, messages.ts, appointments.ts, patients.ts,
                  calendarIntegrations.ts, clinics.ts, escalations.ts — Drizzle,
                  conexión directa, bypassa RLS a propósito (uso exclusivo del backend)
  /supabase
    server.ts   → createSupabaseServerClient() — cliente autenticado (Server
                  Components/Route Handlers), respeta RLS via cookies de sesión
    client.ts   → createSupabaseBrowserClient() — cliente autenticado para
                  Client Components (ej. LoginForm)
    /queries    → conversations.ts, messages.ts — queries del PANEL exclusivamente;
                  usan el cliente autenticado, RLS filtra por clínica del usuario
                  logueado, NUNCA reciben clinicId como parámetro (a propósito:
                  pasar el clinicId a mano sería redundante y un lugar donde un
                  error humano podría filtrar datos entre clínicas)
  /ui           → labels.ts (labels/colores del panel)
  /utils        → time.ts (tiempo relativo)
  config.ts     → DEV_CLINIC_ID — YA NO SE USA en ningún camino caliente (ni webhook
                  ni panel); candidato a eliminar, se mantiene por ahora por si hace
                  falta para scripts de debug/seed locales
  env.ts        → requireEnv()
```

## Reglas de arquitectura no negociables
1. **La IA nunca escribe directo a la base de datos, al calendario ni ejecuta acciones
   irreversibles.** Claude solo devuelve una decisión estructurada (intención + entidades
   extraídas en JSON); el backend valida y ejecuta. Ninguna excepción.
2. **El bot nunca diagnostica, prescribe, ni interpreta síntomas.** Ante cualquier mención
   de dolor, sangrado, fiebre o urgencia médica: escalar a un humano, no responder.
3. **Aislamiento multi-tenant por `clinic_id` + Row Level Security en todas las tablas
   nuevas.** Ninguna tabla se crea sin su política RLS correspondiente.
   **Escribir la política no alcanza — activar RLS es un paso SEPARADO y obligatorio**
   (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`). Una tabla puede tener políticas
   perfectas y seguir totalmente abierta si RLS nunca se activó a nivel de tabla —
   nos pasó el 7 de agosto de 2026 con las 7 tablas del panel, ver "Notas técnicas".
   Verificar SIEMPRE en el Table Editor de Supabase que la tabla no diga
   "UNRESTRICTED" antes de dar por cerrado cualquier trabajo de RLS.
   Además de la política, el rol `authenticated` necesita el `GRANT SELECT`
   correspondiente — las tablas creadas por migración (Drizzle) no lo traen por
   defecto, a diferencia de las creadas desde el Table Editor de Supabase.
4. **No confirmar una acción (cita creada/movida/cancelada) sin que el backend haya
   confirmado el resultado real** contra Google Calendar / Supabase.
5. **Nunca cancelar o reprogramar una cita sin confirmación explícita del paciente.**
6. Secretos solo en variables de entorno (Vercel/Supabase). Nunca en el repo, nunca
   hardcodeados, nunca en un `.env` commiteado. Nunca pegados en chats ni tickets.
   La `anon key` de Supabase es la excepción explícita — está diseñada para ser
   pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), es RLS lo que la hace segura, no su
   confidencialidad. La `service_role key` sí es secreta — nunca usarla en el panel
   ni en ninguna variable con prefijo `NEXT_PUBLIC_`.
7. **Interpretación determinística cuando es posible, IA solo cuando hace falta lenguaje
   natural real.** Ejemplos: `matchSlotSelection.ts` (qué horario eligió el paciente de
   una lista ya ofrecida), `isAffirmative.ts` (sí/no), `isGreeting.ts` (saludos simples,
   evita que el clasificador de IA los escale por error como caso especial — ver
   Notas técnicas). Más barato, más rápido, más confiable que otra llamada a Claude.

## Alcance del MVP (no construir de más)
Sí: bot de WhatsApp (FAQs, agendar, confirmar, reprogramar, cancelar), clasificación de
intención, integración con Google Calendar, panel web mínimo con login (lista de
leads/citas), recordatorio 24h antes, escalamiento a humano, registro de conversaciones
y consentimiento.

No todavía: CRM completo, seguimiento postconsulta, múltiples planes de precio, pagos
integrados, expediente clínico, multiidioma, app móvil, microservicios. La visión de
"panel inteligente" (insights automáticos, alertas, recomendaciones accionables) quedó
documentada en el Excel (Backlog MVP B24-B25, Registro de Decisiones RD07) — Post-MVP
a propósito, no construir antes de validar el piloto. El reporte semanal por correo
(B26) es la excepción: sí se adelanta a F4-F5 por ser la pieza de mayor valor comercial
ya identificada en el Business Case.

## Convenciones
- Componentes y funciones en inglés; textos de cara al usuario (UI, mensajes del bot) en
  español de Costa Rica.
- Commits en inglés, pequeños y descriptivos (ej. "Add appointment status enum", no
  "Agregar estado de citas"). PRs por feature, no por archivo.
- Antes de cualquier cambio al esquema de base de datos: confirmar que la tabla tiene RLS
  **activo** (no solo política escrita — ver Regla #3).
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
- Evitar strings quemados de cara al paciente fuera de `generateReply.ts` — incluso
  mensajes "simples" (ej. saludos) deben pasar por el sistema de tono, no vivir como
  literal en medio de la lógica de orquestación.
- Cliente de Supabase: `lib/db/` (Drizzle) es exclusivo del backend — nunca usarlo en
  código que corre en nombre de un usuario logueado del panel. `lib/supabase/` es
  exclusivo del panel — nunca pasarle un `clinicId` a mano, RLS lo resuelve solo a
  partir de la sesión.

## Notas técnicas / lecciones aprendidas (evitar repetir estos errores)
- **RLS activo ≠ política RLS escrita.** El 7 de agosto de 2026, las 7 tablas del panel
  tenían políticas de `SELECT` bien escritas pero RLS nunca se había activado a nivel de
  tabla (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` faltante) — resultado: con el
  `GRANT SELECT` agregado para destrabar un error de permisos, cualquier usuario
  autenticado veía datos de TODAS las clínicas por un rato. Se corrigió activando RLS
  explícitamente. Verificar siempre el badge "UNRESTRICTED" en el Table Editor.
- **`GRANT` y RLS son capas distintas.** `GRANT SELECT ON tabla TO authenticated` es el
  permiso de entrada (¿puede este rol intentar leer la tabla?); RLS decide qué filas ve
  después de eso. Tablas creadas por migración de Drizzle no traen el `GRANT` por
  defecto (a diferencia de crearlas desde el Table Editor de Supabase) — si el panel
  tira `permission denied for table x (code 42501)`, falta el `GRANT`, no la política.
- **Magic link (Supabase Auth) requiere una ruta de callback explícita**
  (`app/auth/callback/route.ts`) que intercambie el `?code=` por una sesión real vía
  `exchangeCodeForSession()` — el link del correo no autentica por sí solo.
- **Middleware de Next.js usa `supabase.auth.getUser()`, no `getSession()`** — `getUser()`
  valida el token contra el servidor de Supabase en cada request; `getSession()` confía
  ciegamente en la cookie sin verificar. Para una capa de seguridad real, esa validación
  importa.
- **Clasificador de intención (`classify.ts`) escalaba saludos simples como
  `caso_especial`** por descarte — la regla de fail-safe ("ante la duda, escalar") no
  distinguía ambigüedad clínica de ambigüedad conversacional. Se resolvió con
  `isGreeting.ts` (regex, corta el flujo antes de llamar a la IA), no reescribiendo el
  prompt — mismo criterio de la Regla #7.
- **Turbopack (Next.js 16.2.x) tiene una fuga de memoria conocida en sesiones de `next
  dev` largas** — corregida en 16.3 con "memory eviction". Mientras se siga en 16.2.x:
  reiniciar `npm run dev` cada 2-3 horas de trabajo activo en sesiones largas.
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
- **Supabase devuelve columnas en `snake_case`**, no `camelCase` como Drizzle — las
  queries de `lib/supabase/queries/` mapean explícitamente antes de devolver el dato,
  para que el resto del código (ej. `page.tsx`) no tenga que saber la diferencia.

## Cuentas externas
Todas separadas de la cuenta personal de Fabián; identidad de negocio `dentia.cr@gmail.com`
donde aplica (mismo patrón en cada proveedor: cuenta/organización propia de DentIA, no
mezclada con cuentas personales).

- **GitHub**: repo privado `fabian-astorga/dentia`
- **Supabase**: organización "DentIA", proyecto `dentia-dev`
- **Meta for Developers**: Business Portfolio "DentIA", app `DentIA Dev` (clínica de
  prueba original) + app `DentIA Dev - Clínica Sonrisas` (segunda clínica simulada,
  creada para probar aislamiento multi-tenant — **sin número de WhatsApp real propio**,
  Meta parece compartir un solo número de prueba por Business Portfolio; su fila en
  `whatsapp_integrations` usa un `phone_number_id` inventado, `TEST_SONRISAS_001`, solo
  para pruebas simuladas vía `curl`, no recibe WhatsApp real). Token de acceso de la app
  original generado vía System User (`dentia-bot`), válido 60 días desde su generación —
  **revisar fecha de expiración periódicamente**, no hay alerta automática todavía.
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
WhatsApp → Meta → webhook → resuelve clinic_id por phone_number_id → Claude clasifica
                                                                          ↓
                              ¿saludo? → respuesta directa (sin IA, isGreeting.ts)
                              ¿agendar? → extrae fecha/motivo → Google Calendar real
                                  ↓
                    paciente elige horario → crea evento real + guarda en `appointments`
                                  ↓
                         confirma por WhatsApp
```

Completado:
- Webhook de WhatsApp (recepción + verificación de Meta)
- **Resolución dinámica de clínica por `phone_number_id`** — ya no depende de
  `DEV_CLINIC_ID` hardcodeado; probado con una segunda clínica simulada, aislamiento
  multi-tenant confirmado a nivel de webhook/base de datos
- Clasificación de intención con Claude (`faq` / `agendar_cita` / `caso_especial`),
  fail-safe hacia `caso_especial` si algo falla al parsear
- **Detección determinística de saludos** (`isGreeting.ts`) — evita que un simple "hola"
  se escale por error como caso especial, sin gastar una llamada a Claude
- Flujo completo de agendar cita con memoria conversacional (`conversations.context`
  como máquina de estados: `collecting_date` → `awaiting_slot_selection` → cierre)
- Reprogramar y cancelar citas (con confirmación explícita para cancelar, y
  desambiguación cuando el paciente tiene varias citas activas)
- Integración real con Google Calendar (OAuth, lectura de disponibilidad, creación,
  edición y borrado de eventos)
- Sistema de tono de respuestas (`generateReply.ts`) — el código decide QUÉ pasó,
  Claude redacta CÓMO decirlo, con fallback a mensaje genérico si Claude falla
- Notificación real al staff en `caso_especial` (WhatsApp + registro en `escalations`)
- Recordatorio 24h antes (`/api/cron/send-reminders`, protegido con `CRON_SECRET`,
  disparado manualmente por ahora — falta programarlo en Vercel Cron cuando se despliegue)
- **Login del panel con Supabase Auth (magic link)** — `middleware.ts` protege
  `/panel/*`, RLS activo y verificado en las 7 tablas relevantes, queries del panel
  migradas a `lib/supabase/queries/` (cliente autenticado, sin `clinicId` manual)
- Panel visual (`/panel`) — inbox de conversaciones, ahora CON login y aislamiento
  real por clínica. Paleta: navy `#1F3B57`, teal `#0E7C7B`, coral `#D85A30`.
  Tipografía: Bevan (wordmark/títulos) + Inter (todo lo funcional/denso)

Pendiente (en orden sugerido, sin urgencia crítica salvo que se indique):
- Deploy a Vercel + configurar Vercel Cron para los recordatorios
- Borrar `/api/google/test` cuando ya no se necesite para debug
- Fusionar `classify.ts` y `extractDate.ts` en una sola llamada a Claude (optimización
  de costo/latencia, no urgente)
- Reporte semanal por correo a la clínica (B26 del Excel — próximo candidato lógico
  después del panel, alto valor comercial ya identificado)
- Evaluar eliminar `DEV_CLINIC_ID`/`config.ts` si no queda ningún uso real

## Fuente de verdad
El roadmap completo, backlog y decisiones viven en `DentIA_-_Action_Plan___Roadmap.xlsx`
(compartido con Daniel). Este archivo (`CLAUDE.md`) es el resumen técnico operativo —
si hay conflicto entre ambos, el Excel manda para negocio/prioridad, este archivo manda
para reglas de arquitectura.