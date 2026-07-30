export const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  escalated: "Escalada",
  closed: "Cerrada",
};

export const STATUS_STYLE: Record<string, string> = {
  active: "bg-[#E1F5EE] text-[#085041]",
  escalated: "bg-[#FAECE7] text-[#712B13]",
  closed: "bg-[#F1EFE8] text-[#5F5E5A]",
};

export const INTENT_LABEL: Record<string, string> = {
  faq: "Pregunta general",
  agendar_cita: "Agendar cita",
  caso_especial: "Caso especial",
};

export const INTENT_STYLE: Record<string, string> = {
  faq: "bg-[#E1F5EE] text-[#085041]",
  agendar_cita: "bg-[#EEEDFE] text-[#26215C]",
  caso_especial: "bg-[#FAECE7] text-[#712B13]",
};