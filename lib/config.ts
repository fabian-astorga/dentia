import { requireEnv } from "@/lib/env";

// TODO: remove once multi-tenant clinic resolution exists (matching the
// incoming WhatsApp phone_number_id to a clinic). Tracked in the backlog.
export const DEV_CLINIC_ID = requireEnv("DEV_CLINIC_ID");