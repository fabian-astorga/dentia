# DentIA — Contexto del proyecto para Claude Code

## Qué es esto
Asistente de IA por WhatsApp para clínicas dentales pequeñas y medianas (1-5 dentistas)
en Costa Rica. Automatiza recepción, agenda y captura de leads. MVP **en producción real**
(Vercel), estresado con una batería de pruebas reales antes del piloto, equipo de un solo
desarrollador (Fabián), bootstrapped (<$50/mes).

## Stack decidido — no cambiar sin actualizar el ADR correspondiente
- Next.js 16 (App Router) + TypeScript + TailwindCSS
- Supabase (Postgres + Auth + RLS + Storage) — monolito full-stack en Next.js para el MVP
- Drizzle ORM (backend, bypassa RLS a propósito) + `@supabase/ssr` (panel, respeta RLS)
- Claude API — Haiku 4.5 como modelo primario para clasificación y extracción de datos
- WhatsApp Business Cloud API (oficial, Meta) — nunca librerías no oficiales (Baileys, etc.)
- Google Calendar API (OAuth) para disponibilidad y creación de eventos reales
- Resend + React Email para correos transaccionales (reporte semanal)
- Hosting: Vercel, desplegado en producción — `https://dentia-tawny.vercel.app`
  (subdominio gratuito por ahora, sin dominio propio todavía)

## Estructura de carpetas (monolito modular por dominio)
```
/app
  /panel                        → panel visual (inbox de conversaciones), CON login
    /login                      → login por magic link (page.tsx + LoginForm.tsx)
  /auth/callback                → intercambia el ?code= del magic link por una sesión
  /api/whatsapp/webhook         → recepción de mensajes de WhatsApp
  /api/auth/google/start        → inicia el flujo OAuth de Calendar
  /api/auth/google/callback     → recibe el resultado de OAuth y guarda tokens
  /api/cron/send-reminders      → protegida por CRON_SECRET, corre 1x/día vía Vercel Cron
  /api/cron/send-weekly-report  → protegida por CRON_SECRET, corre lunes vía Vercel Cron

vercel.json                     → configuración de Vercel Cron (ver "Cron jobs" abajo)
proxy.ts                        → protege /panel/*, redirige a /panel/login sin sesión
                                   (renombrado desde middleware.ts — convención Next.js 16)

/lib
  /whatsapp     → send.ts, types.ts, parseWebhookPayload.ts (incluye
                  extractPhoneNumberId), replies.ts, handleIncomingMessage.ts
                  (orquestador — recibe clinicId explícito; escalación con mensaje
                  distinto dentro/fuera de horario, ver Notas técnicas),
                  isGreeting.ts (detección determinística de saludos, sin IA), constants.ts
  /ai           → classify.ts (clasificación de intención; "qué días tienen libre" y
                  similares → agendar_cita, no faq — ver Notas técnicas), extractDate.ts,
                  generateReply.ts (sistema de tono; situaciones: greeting, flow_exited,
                  off_topic_during_flow, ask_date, offer_slots, booking_confirmed,
                  reschedule_confirmed, cancellation_confirmed, cancellation_declined,
                  escalation, escalation_after_hours, faq_placeholder),
                  interpretSchedulingIntent.ts, constants.ts
  /google       → client.ts (OAuth), calendar.ts (lectura/creación de eventos),
                  availability.ts (recibe businessHours como parámetro — YA NO es un
                  valor global, ver "Configuración por clínica"), constants.ts
  /scheduling   → handleSchedulingTurn.ts (máquina de estados — ver orden de chequeos
                  en Notas técnicas; calcula `todayISO` con getCostaRicaTodayISO(),
                  NUNCA con new Date().toISOString() directo — ver Notas técnicas,
                  bug #9), timezone.ts (ÚNICA fuente de verdad para el offset de
                  Costa Rica, la conversión UTC↔hora-de-pared, y la fecha de hoy en
                  CR — ver Notas técnicas, bugs #2, #7 y #9; todo lo demás en esta
                  carpeta importa de acá, no duplicar el offset en un archivo nuevo),
                  resolveRelativeDate.ts (cálculo determinístico de fechas relativas
                  — día de semana, "mañana" — SIN IA; Claude solo identifica qué dijo
                  el paciente, este módulo calcula la fecha real — ver Notas
                  técnicas, bug #10), matchSlotSelection.ts (timezone-safe vía
                  timezone.ts, ver Notas técnicas), matchAppointmentByText.ts
                  (timezone-safe vía timezone.ts, y con ancla explícita de hora en
                  `parseTimeFromText` — ver Notas técnicas, bugs #7 y #8),
                  isAffirmative.ts (match por frase completa, no substring — ver
                  Notas técnicas), isDecline.ts (salida determinística del flujo),
                  isMedicalConcern.ts (escalación médica en cualquier paso, máxima
                  prioridad), looksLikeQuestion.ts (detecta cambio de tema en medio
                  del flujo), isWithinBusinessHours.ts (compara hora actual CR contra
                  businessHours de la clínica, vía timezone.ts), format.ts,
                  sendReminders.ts (ventana de día completo, cron 1x/día, vía
                  timezone.ts), constants.ts (ahora son DEFAULTS, ver
                  "Configuración por clínica")
  /notifications → notifyStaff.ts
  /reports      → weekRange.ts — getPreviousWeekRange(), cálculo de semana en hora CR
  /email
    resend.ts   → cliente de Resend
    sendWeeklyReport.ts
    /templates  → WeeklyReportEmail.tsx (React Email)
  /db
    schema.ts, index.ts
    whatsappIntegrations.ts     → getClinicIdByPhoneNumberId() — resuelve clínica por
                                   phone_number_id de Meta, usado por el webhook
    /queries    → conversations.ts, messages.ts, appointments.ts, patients.ts,
                  calendarIntegrations.ts, clinics.ts (incluye
                  getClinicSchedulingConfig() — ver "Configuración por clínica"),
                  escalations.ts, reports.ts (métricas reales para el reporte
                  semanal — sin "horas ahorradas", ver Alcance del MVP) — Drizzle,
                  conexión directa, bypassa RLS a propósito (uso exclusivo del backend)
  /supabase
    server.ts   → createSupabaseServerClient() — cliente autenticado (Server
                  Components/Route Handlers), respeta RLS via cookies de sesión
    client.ts   → createSupabaseBrowserClient() — cliente autenticado para
                  Client Components (ej. LoginForm)
    /queries    → conversations.ts, messages.ts — queries del PANEL exclusivamente;
                  usan el cliente autenticado, RLS filtra por clínica del usuario
                  logueado, NUNCA reciben clinicId como parámetro
  /ui           → labels.ts (labels/colores del panel)
  /utils        → time.ts (tiempo relativo)
  config.ts     → DEV_CLINIC_ID — YA NO SE USA en ningún camino caliente; candidato
                  a eliminar
  env.ts        → requireEnv()
```

## Configuración por clínica (`clinics.config`, jsonb)
Además de `notificationPhone` y `notificationEmail` (ya documentados), ahora también:

- `businessHours: { startHour: number, endHour: number }` — horario de atención propio
  de cada clínica. Si no está configurado, usa `DEFAULT_BUSINESS_HOURS` de
  `lib/scheduling/constants.ts` (8am-5pm).
- `appointmentDurationByReason: Record<string, number>` — duración en minutos por motivo
  de cita (ej. `{"extraccion": 45, "limpieza": 30}`). Si no está configurado, usa
  `DEFAULT_APPOINTMENT_DURATION_BY_REASON`.

**Por qué se movió de `constants.ts` a `clinics.config`**: antes del 11 de agosto de
2026, `BUSINESS_HOURS` y `APPOINTMENT_DURATION_BY_REASON` eran valores globales
compartidos por TODAS las clínicas — un agujero real de multi-tenancy, silencioso hasta
que se conectara una segunda clínica con horario distinto. Se carga a mano en
`clinics.config` al onboardear cada clínica (mismo patrón "concierge" que
`notificationPhone`/`notificationEmail`) — no hay UI de autoservicio para esto todavía,
y no debería construirse hasta que conectar clínicas a mano empiece a doler de verdad
(mismo criterio ya aplicado al resto del onboarding).

Función de acceso: `getClinicSchedulingConfig(clinicId)` en `lib/db/queries/clinics.ts`.

## Cron jobs (Vercel Cron, `vercel.json`)
Plan Hobby (gratis): máximo 1 ejecución/día por cron, hora no exacta (hasta 1h de
margen). `send-reminders`: `0 14 * * *` (8am CR diario, ventana de día completo — no
±1h, ver Notas técnicas). `send-weekly-report`: `0 13 * * 1` (7am CR, lunes).

## Reglas de arquitectura no negociables
1. **La IA nunca escribe directo a la base de datos, al calendario ni ejecuta acciones
   irreversibles.** Claude solo devuelve una decisión estructurada; el backend valida y
   ejecuta. Ninguna excepción.
2. **El bot nunca diagnostica, prescribe, ni interpreta síntomas.** Ante cualquier
   mención de dolor, sangrado, fiebre o urgencia médica: escalar a un humano, no
   responder. **Este chequeo debe correr en TODOS los puntos donde el bot recibe un
   mensaje del paciente, no solo en el primer contacto** — el 10 de agosto de 2026 se
   encontró que un paciente podía mencionar sangrado en medio de elegir un horario de
   cita y el bot lo ignoraba por completo, porque `classifyIntent` (que sí detecta esto)
   nunca vuelve a correr una vez que el flujo de agenda arrancó. Ver `isMedicalConcern.ts`
   y Notas técnicas.
3. **Aislamiento multi-tenant por `clinic_id` + Row Level Security en todas las tablas
   nuevas.** Ninguna tabla se crea sin su política RLS correspondiente. Activar RLS es
   un paso SEPARADO y obligatorio (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`) —
   verificar siempre en el Table Editor de Supabase que la tabla no diga
   "UNRESTRICTED". Además de la política, el rol `authenticated` necesita el
   `GRANT SELECT` correspondiente.
4. **No confirmar una acción sin que el backend haya confirmado el resultado real**
   contra Google Calendar / Supabase.
5. **Nunca cancelar o reprogramar una cita sin confirmación explícita del paciente.**
   Ver la lección de `isAffirmative.ts` en Notas técnicas — un bug de substring hizo
   que "no importa, dejalo así" se interpretara como confirmación y cancelara una cita
   real sin que el paciente lo pidiera.
6. Secretos solo en variables de entorno. La `anon key` de Supabase es la excepción
   explícita — está diseñada para ser pública. La `service_role key` sí es secreta.
7. **Interpretación determinística cuando es posible, IA solo cuando hace falta
   lenguaje natural real.** Ejemplos: `matchSlotSelection.ts`, `isAffirmative.ts`,
   `isGreeting.ts`, `isDecline.ts`, `isMedicalConcern.ts`, `looksLikeQuestion.ts`,
   `isWithinBusinessHours.ts`. Todas comparten un mismo cuidado: **normalizar tildes**
   antes de comparar texto en español (`stripAccents`), y **usar límites de palabra
   explícitos**, nunca `.includes()` plano sobre substrings (ver Notas técnicas —
   mordió dos veces en la misma sesión, en `isAffirmative` y en `resolveDuration`).
8. Al redactar texto libre para el paciente (`generateReply.ts`), el prompt prohíbe
   inventar motivos, síntomas o circunstancias no mencionadas explícitamente.

## Alcance del MVP (no construir de más)
Sí: bot de WhatsApp (FAQs básico, agendar, confirmar, reprogramar, cancelar),
clasificación de intención, integración con Google Calendar (horarios y duraciones
por-clínica), panel web con login, recordatorio diario, escalamiento a humano
(con mensaje distinto dentro/fuera de horario), registro de conversaciones y
consentimiento, reporte semanal por correo.

No todavía: CRM completo, seguimiento postconsulta, múltiples planes de precio, pagos
integrados, expediente clínico, multiidioma, app móvil, microservicios, memoria de
conversación entre visitas distintas del mismo paciente (pregunta de producto abierta,
ver Pendientes), algoritmo de huecos que aproveche espacios entre citas ya agendadas
(hoy usa una grilla simple alineada a la duración pedida — suficiente para el volumen
de un piloto, ver Notas técnicas). La visión de "panel inteligente" (insights, alertas,
recomendaciones) sigue documentada en el Excel (B24-B25, RD07) como Post-MVP a
propósito.

## Notas técnicas / lecciones aprendidas — sesión de stress-testing (10-11 de agosto 2026)

Antes de mostrarle el bot a cualquier dentista real, se hizo una batería deliberada de
mensajes desprolijos, ambiguos, y casos límite. Se encontraron y arreglaron **6 bugs
reales**, varios con impacto en datos reales (citas mal agendadas o canceladas sin
confirmación) — quedan documentados acá para no repetir el mismo tipo de error:

1. **`isAffirmative.ts` interpretaba "no importa, dejalo así" como un SÍ**, porque
   `.includes("si")` matchea el substring "si" dentro de "a**si**" — canceló una cita
   real sin que el paciente lo confirmara (viola Regla #5). Arreglo: comparación por
   frase completa con límites de palabra (`\b`), no substring plano, más
   `stripAccents` para no depender de tildes.
2. **`matchSlotSelection.ts` usaba `Date.getHours()`/`getMinutes()` locales del
   servidor** — funcionaba por casualidad en local (servidor en hora CR) pero en
   Vercel (servidor en UTC) el offset de 6 horas de Costa Rica hizo que "4pm" matcheara
   por coincidencia matemática con el slot de las 10am, agendando una cita a la hora
   equivocada sin avisar. Arreglo: conversión explícita a hora CR antes de comparar,
   mismo patrón que `format.ts` ya usaba correctamente.
3. **El flujo de agenda podía entrar en loop infinito** si el paciente escribía algo
   que no fuera exactamente una fecha/horario válido (ej. "ya no gracias") — el bot
   repetía la misma pregunta indefinidamente, sensación de acoso para el paciente.
   Arreglo: `isDecline.ts`, chequeado al principio de `handleSchedulingTurn`, corta el
   flujo con un mensaje cálido en vez de repetir. Excluye `confirming_cancellation`
   (ahí un "no" significa "no cancelar", no "salir de la conversación").
4. **Mención médica urgente en medio del flujo de agenda no escalaba** (ver Regla #2)
   — `classifyIntent` solo corre en el primer mensaje, nunca dentro de la máquina de
   estados. Arreglo: `isMedicalConcern.ts`, chequeado con MÁXIMA prioridad (antes que
   `isDecline`) en cualquier paso. Ojo con el propio bug de regex al escribir esto: usar
   raíces con `\w*` después (`sangr\w*`), nunca `\b` pegado directo a una raíz
   (`sangr\b` solo matchea la palabra "sangr" sola, que no existe — dejaría pasar
   "sangrando" sin detectar).
5. **"qué días tienen libre" clasificaba como `faq`**, cayendo en el placeholder sin
   funcionalidad real ("todavía estoy aprendiendo... llamá a recepción") — pérdida de
   conversión real para una pregunta que casi siempre significa "quiero agendar".
   Arreglo: aclaración explícita en el prompt de `classify.ts`.
6. **Cambiar de tema en medio del flujo** (ej. preguntar "cuánto cuesta" mientras el
   bot espera una fecha) hacía que el bot repitiera ciegamente "no logré entender la
   fecha" — el paciente siente que no lo escuchan. Arreglo: `looksLikeQuestion.ts`
   detecta que el mensaje parece una pregunta nueva (no un intento fallido de dar el
   dato pedido) y responde reconociendo el cambio de tema sin perder el `context.step`.

Además, un bug de **tildes** en `resolveDuration` (`handleSchedulingTurn.ts`):
"extracción" (como escribe un paciente real) no matcheaba la clave `"extraccion"` (sin
tilde) en la tabla de duraciones, cayendo silenciosamente en el default de 30 min en vez
de los 45 correctos. Mismo arreglo de `stripAccents` en ambos lados de la comparación.

**Continuación — probando Categoría 6 (múltiples citas activas simultáneas), 13 de
agosto 2026.** Dos bugs más, misma familia que el #2 (viola Regla #5: nunca
cancelar/reprogramar sin confirmación real sobre la cita correcta):

7. **`matchAppointmentByText.ts` comparaba hora de pared CR (lo que escribió el
   paciente) contra `scheduledAt.getUTCHours()`/`getUTCMinutes()` crudos (UTC, sin
   convertir)** — a diferencia del bug #2, acá no fallaba con un `null` inofensivo:
   con dos citas el mismo día a las 9am y 3pm CR, "la de las 3pm" (hour: 15) matcheaba
   por coincidencia numérica la cita de las 9am (guardada como 15:00 UTC), devolviendo
   la cita EQUIVOCADA con confianza total (`refined.length === 1`), lista para
   cancelar/reprogramar. Arreglo: extraído `lib/scheduling/timezone.ts` como única
   fuente de verdad del offset de CR (antes copiado 3 veces: `matchSlotSelection.ts`,
   `isWithinBusinessHours.ts`, `sendReminders.ts`) — `matchAppointmentByText.ts` ahora
   importa `getCostaRicaHourAndMinute` de ahí en vez de agregar una cuarta copia.
8. **La regex de `parseTimeFromText` tomaba el primer número suelto del texto como
   hora, sin exigir am/pm ni `:minutos`** — "la del 15 de agosto" (sin hora
   mencionada) capturaba el "15" del día del mes como `hour: 15`, y por coincidencia
   volvía a matchear una cita de las 3pm CR (15h en formato 24h) sin que el paciente
   hubiera dicho ninguna hora. Encontrado recién al probar el caso "solo fecha,
   ambiguo" de Categoría 6 — el fix del bug #7 por sí solo no lo cubría. Arreglo:
   `parseTimeFromText` ahora exige una ancla explícita (am/pm o `:minutos`) para
   aceptar un número como hora; sin ancla, devuelve `null` (pide aclaración) en vez de
   adivinar. **Pendiente**: revisar si `matchSlotSelection.ts` tiene el mismo riesgo —
   usa una regex de hora casi idéntica (ver Pendiente #2).

Los 4 fixes de `matchAppointmentByText.ts` fueron validados con un script aislado
(`npx tsx --env-file=.env.local`, invoca la función directo con candidatos mock) antes
de tocar producción — más rápido que iterar por WhatsApp real para bugs de lógica pura,
sin gastar llamadas a Claude ni depender del webhook. La validación end-to-end con
WhatsApp real queda como último paso antes de cerrar Categoría 6 (ver Pendiente #1).

9. **`handleSchedulingTurn.ts` calculaba `todayISO` con
   `new Date().toISOString().slice(0, 10)` — fecha en UTC del servidor, no en hora de
   Costa Rica.** Como CR está 6 horas atrás de UTC, cualquier momento después de ~6pm
   hora CR ya cruzó a "mañana" en UTC. Ese `todayISO` mal calculado se propagaba a
   `extractDateAndReason`, `interpretSchedulingIntent` y `matchAppointmentByText` (los
   tres lo reciben como parámetro, ninguno lo recalcula). Encontrado probando
   Categoría 6 a las 7:41pm CR: "el viernes" volvió a resolver una semana después en
   vez de mañana — el fix del bug de fechas relativas (más abajo) estaba funcionando
   perfecto, pero el insumo que recibía ("hoy") ya estaba mal. Arreglo: nuevo
   `getCostaRicaTodayISO()` en `timezone.ts`, usado en el único punto de origen
   (`handleSchedulingTurn.ts`) — se corrige para los tres callers downstream sin
   tocarlos. Validado con Date simulado a las 7:41pm CR antes de deployar.

**Bug de fechas relativas, mismo día (13 de agosto 2026), encontrado en el camino de
probar Categoría 6 — no es de la familia de la Regla #5, pero es el mismo patrón de
"parece razonable, falla en un caso real":**

10. **`extractDate.ts` e `interpretSchedulingIntent.ts` le pedían a Claude que calculara
    la fecha de "el próximo día de la semana" dentro del prompt** — instrucción
    ambigua incluso para humanos ("el próximo viernes" dicho un jueves puede
    entenderse como mañana, o como saltarse ese y ser el de la semana siguiente).
    Encontrado con un caso real: "viernes" dicho un jueves resolvió al viernes de la
    semana siguiente, no al día siguiente. Arreglo: se le sacó el cálculo a Claude
    por completo — ahora solo identifica QUÉ dijo el paciente (día de semana
    suelto, "mañana", fecha explícita) vía un `dateSignal` estructurado, y un nuevo
    módulo determinístico (`lib/scheduling/resolveRelativeDate.ts`, sin IA) calcula
    la fecha real. Mismo principio que `matchSlotSelection.ts`: entender texto es
    trabajo de Claude, calcular es trabajo de código. El prompt estaba duplicado en
    los dos archivos — el fix se escribió una sola vez en el módulo compartido.

**Orden de chequeos en `handleSchedulingTurn.ts`** (importa el orden, no es arbitrario):
`isMedicalConcern` (máxima prioridad, sin excepción de paso) → `isDecline` (excepto en
`confirming_cancellation`) → el switch normal por `context.step`, con
`looksLikeQuestion` como red de seguridad dentro de `collecting_date` y
`awaiting_slot_selection` cuando la extracción específica de ese paso falla.

- **Google OAuth: refresh token expira a los 7 días mientras la app esté en modo
  "Testing" (no verificada).** Arreglo temporal: reconectar vía `/api/auth/google/start`.
  **Pendiente**: investigar si el scope de Calendar usado permite publicar la consent
  screen sin el proceso completo de verificación de Google.
- **RLS activo ≠ política RLS escrita** — activar RLS es un paso separado del `CREATE
  POLICY`. Verificar siempre el badge "UNRESTRICTED" en Supabase.
- **`GRANT` y RLS son capas distintas** — `GRANT SELECT` es el permiso de entrada, RLS
  decide qué filas. Tablas creadas por migración Drizzle no traen el `GRANT` por
  defecto.
- **Vercel Cron (Hobby) limita a 1 ejecución/día por cron, sin hora exacta.**
- **Next.js 16 renombró `middleware.ts` a `proxy.ts`.** Ya migrado.
- **Magic link requiere `app/auth/callback/route.ts`** con `exchangeCodeForSession()`.
- **Middleware/proxy usa `supabase.auth.getUser()`, no `getSession()`.**
- **Turbopack (Next.js 16.2.x) tiene fuga de memoria conocida en sesiones largas de
  `next dev`** — corregida en 16.3. Reiniciar cada 2-3h mientras se siga en 16.2.x.
- **Resend, con el dominio de pruebas, solo manda correos a la dirección registrada** —
  pendiente verificar dominio propio.
- **Supabase + drizzle-kit**: usar `DIRECT_DATABASE_URL` solo para migraciones.
- **Claude envuelve el JSON en \`\`\`json a veces** — limpiar antes de parsear.
- **`&&` vs `??` con strings vacíos** — usar condicionales explícitos.
- **Supabase devuelve columnas en `snake_case`**, no `camelCase` — mapear explícito en
  `lib/supabase/queries/`.

## Cuentas externas
(sin cambios desde la última actualización — Vercel `dentia-tawny.vercel.app` con 2FA,
Meta `DentIA Dev` + `DentIA Dev - Clínica Sonrisas` simulada, Supabase `dentia-dev`,
Google Cloud en modo Testing, Resend con dominio de pruebas — ver detalle completo en
el historial de decisiones si hace falta el detalle exacto de cada una)

## Estado actual del proyecto
**En producción real**, circuito completo probado y estresado deliberadamente con casos
límite antes del piloto — **10 bugs reales** encontrados y arreglados en total (6 de la
sesión de stress-testing del 10-11 de agosto, 4 más el 13 de agosto probando
Categoría 6), incluyendo cuatro con impacto directo en datos (cita agendada a hora
equivocada, cita cancelada sin confirmación real, y el trío de bugs #7/#8/#9 que podían
hacer actuar sobre la cita equivocada o calcular fechas mal cuando el paciente tenía más
de una cita activa). **Categoría 6 (múltiples citas activas simultáneas) cerrada de
punta a punta**: los 5 casos de desambiguación (hora exacta, fecha ambigua, hora
inexistente, mensaje vago, resolución tras pedir precisión) validados con WhatsApp real
contra el bot en producción, no solo con script.

Pendiente (en orden sugerido):
1. Revisar si `matchSlotSelection.ts` tiene el mismo riesgo del bug #8 (número suelto
   sin ancla de am/pm o `:minutos` interpretado como hora) — regex casi idéntica a la
   que tenía `parseTimeFromText` antes del fix, no confirmado todavía si aplica en ese
   contexto (ahí el paciente responde sobre una lista cerrada de horarios ofrecidos)
2. Mejorar la redacción del mensaje de desambiguación cuando el paciente ya dio la
   fecha pero falta la hora — hoy dice "escribime la fecha exacta" aunque el paciente
   ya la dio (solo falta la hora), puede confundir en un caso real; detectado
   probando Categoría 6 (ver captura de WhatsApp, 13 de agosto)
3. Soporte para selección de horario por posición ("el segundo", "el primero") en
   `matchSlotSelection.ts` — hoy solo entiende horas explícitas
4. Ajuste de voseo costarricense en el prompt de `generateReply.ts` — Claude generó
   "Entendé" (imperativo) donde correspondía "Entiendo" (primera persona) en un mensaje
   de escalación; agregar regla explícita al `SYSTEM_PROMPT`
5. Decisión de producto: ¿memoria de conversación entre visitas distintas del mismo
   paciente? Hoy `context` es solo memoria de corto plazo del flujo en curso, se
   resetea a `{}` al terminar cada flujo; ninguna llamada a Claude lee el historial de
   `messages`. Pros/contras y costo en tokens a evaluar antes de construir nada
6. Investigar publicar la OAuth consent screen de Google (ver Notas técnicas)
7. Verificar dominio propio en Resend
8. Considerar dominio propio para la app en vez del subdominio de Vercel
9. Fusionar `classify.ts` + `interpretSchedulingIntent.ts` en una sola llamada (cambio
   de riesgo real sobre el flujo de agenda ya probado — hacer con sesión fresca)
10. Preparar presentación final para clientes piloto: demo curada de camino feliz,
    features Post-MVP como visión de producto (memoria de paciente, insights, B24-B26
    del Excel), reporte semanal ya construido como diferenciador, estructura de
    suscripciones/precios (pendiente de definir con datos reales del piloto)
11. Actualizar el Excel con todo el trabajo de ambas sesiones — sigue desactualizado
12. Evaluar eliminar `DEV_CLINIC_ID`/`config.ts` si no queda ningún uso real

## Fuente de verdad
El roadmap completo, backlog y decisiones viven en `DentIA_-_Action_Plan___Roadmap.xlsx`
(compartido con Daniel) — desactualizado respecto al código real, ver pendiente #10.
Este archivo (`CLAUDE.md`) es el resumen técnico operativo — si hay conflicto entre
ambos, el Excel manda para negocio/prioridad, este archivo manda para reglas de
arquitectura.