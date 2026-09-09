export const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  escalated: "Escalada",
  closed: "Cerrada",
};

export const STATUS_STYLE: Record<string, string> = {
  active: "bg-status-positive-bg text-status-positive-text",
  escalated: "bg-status-alert-bg text-status-alert-text",
  closed: "bg-status-neutral-bg text-status-neutral-text",
};

export const INTENT_LABEL: Record<string, string> = {
  faq: "Pregunta general",
  agendar_cita: "Agendar cita",
  reprogramar_cita: "Reprogramar cita",
  cancelar_cita: "Cancelar cita",
  caso_especial: "Caso especial",
  saludo: "Saludo",
  cortesia: "Cortesía",
};

export const INTENT_STYLE: Record<string, string> = {
  faq: "bg-status-info-bg text-status-info-text",
  agendar_cita: "bg-status-positive-bg text-status-positive-text",
  reprogramar_cita: "bg-status-info-bg text-status-info-text",
  cancelar_cita: "bg-status-neutral-bg text-status-neutral-text",
  caso_especial: "bg-status-alert-bg text-status-alert-text",
  saludo: "bg-status-warm-bg text-status-warm-text",
  cortesia: "bg-status-neutral-bg text-status-neutral-text",
};