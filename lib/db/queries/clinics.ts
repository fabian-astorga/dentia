import { db } from "@/lib/db";
import { clinics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_APPOINTMENT_DURATION_BY_REASON,
} from "@/lib/scheduling/constants";

export interface BusinessHours {
  startHour: number;
  endHour: number;
}

interface ClinicConfig {
  notificationPhone?: string;
  notificationEmail?: string;
  businessHours?: BusinessHours;
  appointmentDurationByReason?: Record<string, number>;
}

export interface ClinicSchedulingConfig {
  businessHours: BusinessHours;
  appointmentDurationByReason: Record<string, number>;
}

export async function getClinicById(clinicId: string) {
  const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
  return clinic ?? null;
}

export async function getClinicNotificationPhone(clinicId: string): Promise<string | null> {
  const clinic = await getClinicById(clinicId);
  const config = (clinic?.config as ClinicConfig) ?? {};
  return config.notificationPhone ?? null;
}

// Horario de atención + duraciones por motivo, propios de cada clínica
// — tomados de clinics.config, o los defaults si la clínica todavía no
// tiene los suyos configurados. Se carga a mano en clinics.config al
// onboardear cada clínica (mismo patrón "concierge" que
// notificationPhone/notificationEmail) — sin esto, todas las clínicas
// compartían sin querer un único horario global.
export async function getClinicSchedulingConfig(clinicId: string): Promise<ClinicSchedulingConfig> {
  const clinic = await getClinicById(clinicId);
  const config = (clinic?.config as ClinicConfig) ?? {};

  return {
    businessHours: config.businessHours ?? DEFAULT_BUSINESS_HOURS,
    appointmentDurationByReason: config.appointmentDurationByReason ?? DEFAULT_APPOINTMENT_DURATION_BY_REASON,
  };
}