import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  boolean,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────

export const clinicMemberRole = pgEnum("clinic_member_role", ["owner", "staff"]);
export const leadStatus = pgEnum("lead_status", ["new", "contacted", "converted", "inactive"]);
export const conversationStatus = pgEnum("conversation_status", ["active", "escalated", "closed"]);
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const appointmentStatus = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);
export const escalationStatus = pgEnum("escalation_status", ["open", "resolved"]);
export const consentType = pgEnum("consent_type", ["data_processing", "whatsapp_communication"]);

// ─── Clinics (tenant root) ──────────────────────────────────────────────

export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  whatsappPhoneNumber: text("whatsapp_phone_number"),
  timezone: text("timezone").notNull().default("America/Costa_Rica"),
  // Flexible per-clinic settings (hours, FAQs tone, prices) to avoid
  // migrating the schema every time a new setting is needed.
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Clinic members ─────────────────────────────────────────────────────
// Links a Supabase Auth user (auth.users, managed outside our schema)
// to a clinic, with a role. This is what RLS policies check against.

export const clinicMembers = pgTable("clinic_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(), // references auth.users.id (Supabase-managed)
  role: clinicMemberRole("role").notNull().default("staff"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Patients ───────────────────────────────────────────────────────────

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    name: text("name"),
    phone: text("phone").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("patients_clinic_phone_idx").on(table.clinicId, table.phone),
  ]
);

// ─── Leads ──────────────────────────────────────────────────────────────

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    status: leadStatus("status").notNull().default("new"),
    // One-line reason only — never clinical/symptom detail (see CLAUDE.md).
    reason: text("reason"),
    source: text("source").notNull().default("whatsapp"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("leads_clinic_idx").on(table.clinicId)]
);

// ─── Conversations ──────────────────────────────────────────────────────
// One thread per (clinic, phone). Holds the conversational state so the
// bot knows what it's waiting for, even days after the last message.

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    phone: text("phone").notNull(),
    status: conversationStatus("status").notNull().default("active"),
    // Conversational state machine context, e.g.
    // { step: "awaiting_time_selection", pendingLeadId: "...", offeredSlots: [...] }
    context: jsonb("context").notNull().default({}),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("conversations_clinic_phone_idx").on(table.clinicId, table.phone),
  ]
);

// ─── Messages ───────────────────────────────────────────────────────────
// No clinic_id here on purpose — tenant scoping is reached through
// conversations (see RLS policy below).

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: messageDirection("direction").notNull(),
    content: text("content").notNull(),
    detectedIntent: text("detected_intent"), // null for outbound or when not applicable
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId)]
);

// ─── Appointments ───────────────────────────────────────────────────────
// Status values mirror the state machine diagram exactly. Transition
// rules are enforced in backend code, not in the database.

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    // Free text for the MVP (single-calendar-per-clinic assumption,
    // see open decision DP02 — revisit if multi-dentist is confirmed).
    dentistName: text("dentist_name"),
    scheduledAt: timestamp("scheduled_at").notNull(),
    status: appointmentStatus("status").notNull().default("pending"),
    // Google Calendar event id, so we can update/cancel the real event
    // instead of trusting our own copy of the date.
    calendarEventId: text("calendar_event_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("appointments_clinic_idx").on(table.clinicId),
    index("appointments_clinic_scheduled_idx").on(table.clinicId, table.scheduledAt),
  ]
);

// ─── WhatsApp integration ───────────────────────────────────────────────
// One row per clinic. Contains secrets — only the backend (service role,
// which bypasses RLS) should ever read this table. No staff-facing
// select policy is defined for this table on purpose.

export const whatsappIntegrations = pgTable("whatsapp_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  phoneNumberId: text("phone_number_id").notNull(), // Meta's phone_number_id
  businessAccountId: text("business_account_id"),
  accessToken: text("access_token").notNull(), // long-lived token, treat as a secret
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

// ─── Calendar integration ───────────────────────────────────────────────
// Same secrecy rule as whatsapp_integrations: backend-only, no staff
// select policy.

export const calendarIntegrations = pgTable("calendar_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

// ─── FAQs ───────────────────────────────────────────────────────────────
// Configurable per clinic; feeds the intent classifier / FAQ answers.

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("faqs_clinic_idx").on(table.clinicId)]
);

// ─── Escalations ────────────────────────────────────────────────────────
// Tracks every conversation handed off to a human, and by whom it was
// picked up. Directly feeds the "% resolved without human" metric.

export const escalations = pgTable(
  "escalations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // e.g. "mentions pain/fever", "low confidence intent"
    status: escalationStatus("status").notNull().default("open"),
    attendedBy: uuid("attended_by"), // references auth.users.id, nullable until picked up
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [index("escalations_clinic_idx").on(table.clinicId)]
);

// ─── Audit log ──────────────────────────────────────────────────────────
// Minimal accountability trail: who changed what. Not a full audit
// system — just enough to answer "who moved this appointment".

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").references(() => clinics.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(), // user_id as text, or "bot" / "system"
    action: text("action").notNull(), // e.g. "appointment.cancelled"
    entityType: text("entity_type").notNull(), // e.g. "appointment"
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("audit_logs_clinic_idx").on(table.clinicId)]
);

// ─── Consents ───────────────────────────────────────────────────────────
// Required from day 1, not optional — see CLAUDE.md and the privacy
// notice requirement (Ley 8968, Costa Rica).

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    type: consentType("type").notNull(),
    channel: text("channel").notNull().default("whatsapp"),
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [index("consents_clinic_idx").on(table.clinicId)]
);