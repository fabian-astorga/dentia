// Cálculo determinístico de "a qué fecha exacta corresponde esto" a
// partir de una señal cruda (día de semana, o relativo tipo "mañana").
// Antes esto se le pedía directamente a Claude dentro del prompt de
// extractDate.ts / interpretSchedulingIntent.ts ("día de semana = el
// próximo") — y produjo un bug real: "viernes" dicho un jueves resolvió
// una semana después de lo esperado (viernes 21 en vez de viernes 14),
// porque "el próximo viernes" es ambiguo incluso para humanos. Ver
// Notas técnicas en CLAUDE.md.
//
// Mismo principio que matchSlotSelection.ts: entender texto es trabajo
// de Claude, calcular es trabajo de código determinístico.

const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
// índice = Date.getUTCDay() (domingo = 0)

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Mediodía fijo en hora CR para evitar problemas de borde de día —
// mismo patrón que formatDateLabel en format.ts.
function costaRicaNoon(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00-06:00`);
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Próxima ocurrencia del día de semana dado, contando SIEMPRE desde
// mañana — nunca hoy, nunca salta una semana de más. Si el paciente
// nombra el mismo día de semana que hoy, se asume la semana próxima
// (si quisiera decir "hoy", diría "hoy", no el nombre del día).
export function resolveWeekdayDate(todayISO: string, weekdayName: string): string | null {
  const normalized = stripAccents(weekdayName.toLowerCase().trim());
  const targetDow = WEEKDAY_NAMES.indexOf(normalized);
  if (targetDow === -1) return null;

  const today = costaRicaNoon(todayISO);
  const todayDow = today.getUTCDay();

  let daysAhead = (targetDow - todayDow + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;

  const result = new Date(today);
  result.setUTCDate(result.getUTCDate() + daysAhead);
  return toISODate(result);
}

export type RelativeDayKind = "hoy" | "manana" | "pasado_manana";

export function resolveRelativeDayDate(todayISO: string, kind: RelativeDayKind): string {
  const offset = kind === "hoy" ? 0 : kind === "manana" ? 1 : 2;
  const result = costaRicaNoon(todayISO);
  result.setUTCDate(result.getUTCDate() + offset);
  return toISODate(result);
}

// Forma cruda que Claude devuelve — sin calcular ninguna fecha, solo
// identificando qué tipo de mención hizo el paciente.
export type DateSignal =
  | { type: "explicit"; value: string } // Claude ya la convirtió a YYYY-MM-DD (fecha explícita mencionada, ej. "20 de agosto")
  | { type: "weekday"; value: string } // nombre del día, ej. "viernes"
  | { type: "relative"; value: RelativeDayKind };

// Resuelve la señal cruda a una fecha final YYYY-MM-DD, o null si la
// señal es inválida/ausente. Único punto donde extractDate.ts e
// interpretSchedulingIntent.ts convierten "qué dijo el paciente" en
// "qué fecha es" — antes cada uno le pedía a Claude que lo calculara
// por su cuenta, con prompts casi idénticos y duplicados.
export function resolveDateSignal(signal: DateSignal | null | undefined, todayISO: string): string | null {
  if (!signal) return null;

  switch (signal.type) {
    case "explicit":
      return signal.value ?? null;
    case "weekday":
      return resolveWeekdayDate(todayISO, signal.value);
    case "relative":
      return resolveRelativeDayDate(todayISO, signal.value);
    default:
      return null;
  }
}