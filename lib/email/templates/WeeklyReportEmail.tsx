import { Html, Head, Preview, Body, Container, Section, Heading, Text, Hr } from "@react-email/components";
import type { WeeklyMetrics } from "@/lib/db/queries/reports";

interface WeeklyReportEmailProps {
  clinicName: string;
  metrics: WeeklyMetrics;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CR", { day: "numeric", month: "long" });
}

export function WeeklyReportEmail({ clinicName, metrics }: WeeklyReportEmailProps) {
  const { weekStart, weekEnd, conversationsHandled, resolvedWithoutHumanPct, appointmentsCreated, escalatedCases } = metrics;
  const weekEndDisplay = new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000); // domingo, no el lunes siguiente

  return (
    <Html>
      <Head />
      <Preview>Tu resumen semanal de DentIA está listo</Preview>
      <Body style={{ backgroundColor: "#F7F5F1", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#FFFFFF", padding: "32px", borderRadius: "8px" }}>
          <Heading style={{ color: "#1F3B57", fontSize: "20px" }}>🦷 DentIA</Heading>
          <Text style={{ color: "#8A8778", fontSize: "13px", marginTop: "-8px" }}>
            Resumen de {clinicName} — {formatDate(weekStart)} al {formatDate(weekEndDisplay)}
          </Text>
          <Hr style={{ borderColor: "#E4E1D8", margin: "20px 0" }} />

          <Section>
            <Text style={{ fontSize: "14px", color: "#1B2430" }}>
              <strong>{conversationsHandled}</strong> conversaciones atendidas por WhatsApp
            </Text>
            <Text style={{ fontSize: "14px", color: "#1B2430" }}>
              <strong>{resolvedWithoutHumanPct === null ? "—" : `${resolvedWithoutHumanPct}%`}</strong> resueltas sin intervención humana
            </Text>
            <Text style={{ fontSize: "14px", color: "#1B2430" }}>
              <strong>{appointmentsCreated}</strong> citas generadas
            </Text>
            <Text style={{ fontSize: "14px", color: "#1B2430" }}>
              <strong>{escalatedCases}</strong> casos escalados al personal
            </Text>
          </Section>

          <Hr style={{ borderColor: "#E4E1D8", margin: "20px 0" }} />
          <Text style={{ fontSize: "11px", color: "#B0AD9F" }}>
            Este resumen se genera automáticamente cada lunes. Si tenés dudas sobre estos números, respondé este correo.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}