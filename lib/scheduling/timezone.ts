// Única fuente de verdad para el offset y la conversión de zona horaria
// de Costa Rica. Antes este mismo patrón (offset -6, sin horario de
// verano) estaba copiado en matchSlotSelection.ts, isWithinBusinessHours.ts
// y sendReminders.ts — y matchAppointmentByText.ts iba a ser la cuarta
// copia el día que alguien necesitara comparar una hora parseada del
// paciente (hora de pared CR) contra un Date guardado en UTC.
//
// Todo lo que necesite "¿qué hora es esto en Costa Rica?" o "¿a qué
// instante UTC corresponde esta hora de pared CR?" importa de acá.
export const COSTA_RICA_UTC_OFFSET_HOURS = -6;

// Desplaza un instante UTC real a un Date cuyos valores getUTC*()
// representan la hora de PARED de Costa Rica — no un instante real.
// Por eso todo lo que consuma este resultado debe leerse con
// getUTCHours()/getUTCMinutes()/setUTCHours(), nunca con los métodos
// locales (esos leen la zona horaria del SERVIDOR: CR en local, UTC en
// Vercel — ver Notas técnicas en CLAUDE.md, bug de matchSlotSelection).
function toCostaRicaWallClock(date: Date): Date {
  return new Date(date.getTime() + COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

// Inversa de toCostaRicaWallClock: toma un Date que representa hora de
// pared CR (como los que arma sendReminders al construir límites de
// día) y devuelve el instante UTC real correspondiente, comparable
// contra columnas guardadas en la base de datos.
function fromCostaRicaWallClock(wallClockDate: Date): Date {
  return new Date(wallClockDate.getTime() - COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

// Hora y minuto en Costa Rica de un instante UTC real. Acepta Date o
// string ISO para no obligar a cada caller a hacer el new Date() antes.
export function getCostaRicaHourAndMinute(input: Date | string): { hour: number; minute: number } {
  const date = typeof input === "string" ? new Date(input) : input;
  const crDate = toCostaRicaWallClock(date);
  return { hour: crDate.getUTCHours(), minute: crDate.getUTCMinutes() };
}

// Fecha calendario ACTUAL en Costa Rica (YYYY-MM-DD), no en UTC del
// servidor. IMPORTANTE: `new Date().toISOString().slice(0, 10)` da la
// fecha en UTC — como CR está 6 horas atrás, cualquier momento después
// de las ~6pm hora CR ya cruzó a "mañana" en UTC. Eso hacía que
// handleSchedulingTurn.ts calculara `todayISO` un día adelantado
// durante la tarde/noche en CR, y con eso `resolveWeekdayDate` recibía
// un "hoy" equivocado — encontrado probando a las 7:41pm CR, donde
// "viernes" volvió a resolver a una semana después en vez de mañana.
export function getCostaRicaTodayISO(referenceDate: Date = new Date()): string {
  return toCostaRicaWallClock(referenceDate).toISOString().slice(0, 10);
}

// Solo la hora actual en Costa Rica — usado para comparar contra
// businessHours (isWithinBusinessHours.ts).
export function getCurrentCostaRicaHour(referenceDate: Date = new Date()): number {
  return toCostaRicaWallClock(referenceDate).getUTCHours();
}

// Medianoche de Costa Rica del día calendario de `referenceDate`,
// expresada como instante UTC real. Base para calcular ventanas de día
// completo en CR (sendReminders.ts) sin repetir la aritmética de ida y
// vuelta en cada archivo que la necesite.
export function getCostaRicaMidnightUTC(referenceDate: Date = new Date()): Date {
  const crWallClock = toCostaRicaWallClock(referenceDate);
  crWallClock.setUTCHours(0, 0, 0, 0);
  return fromCostaRicaWallClock(crWallClock);
}