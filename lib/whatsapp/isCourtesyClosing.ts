// Detección determinística de que el mensaje es SOLO un cierre cordial
// (agradecimiento, despedida corta) sin contenido adicional — mismo
// patrón que isGreeting.ts, evita mandarle esto a classifyIntent.
//
// Antes, mensajes así caían en el fallback de classify.ts ("ambiguo →
// caso_especial", pensado para posibles urgencias médicas) y un simple
// "gracias" disparaba una falsa alarma: notificación al staff y un
// mensaje de "acudí a emergencias" al paciente. Encontrado en vivo
// probando Categoría 6 — ver Notas técnicas en CLAUDE.md.
//
// Anclado a MENSAJE COMPLETO (mismo criterio que isDecline.ts), no a
// "contiene la palabra": así "gracias, pero me sigue doliendo" NO se
// confunde con un cierre cordial y sigue su camino normal hacia el
// clasificador — la seguridad ante posible urgencia médica no se
// pierde, solo se evita el falso positivo en el caso simple.
const CLOSING_PATTERNS = [
  /^(muchas|mil )?gracias[\s!?.,¡¿]*$/i,
  /^listo[\s!?.,¡¿]*$/i,
  /^dale[\s!?.,¡¿]*$/i,
  /^perfecto[\s!?.,¡¿]*$/i,
  /^ok(ay)?[\s!?.,¡¿]*$/i,
  /^vale[\s!?.,¡¿]*$/i,
  /^chao[\s!?.,¡¿]*$/i,
  /^nos vemos[\s!?.,¡¿]*$/i,
  /^buen[ií]simo[\s!?.,¡¿]*$/i,
  /^entendido[\s!?.,¡¿]*$/i,
];

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isCourtesyClosing(messageText: string): boolean {
  const normalized = stripAccents(messageText.trim().toLowerCase());
  return CLOSING_PATTERNS.some((pattern) => pattern.test(normalized));
}