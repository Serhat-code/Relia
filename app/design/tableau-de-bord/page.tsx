import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { DashboardView } from "@/components/dashboard/DashboardView";
import type { DashboardData } from "@/lib/data/dashboard";
import { parseDashboardSummary } from "@/lib/dashboard/summary";
import { isProductionDeployment } from "@/lib/env";

export const metadata: Metadata = { title: "Tableau de bord (démonstration)", robots: { index: false, follow: false } };

const TODAY = "2026-09-21";

// Démonstration interne du palier 12 (sans base de données) : même forme que public.dashboard_summary().
const SUMMARY = parseDashboardSummary({
  open_amount: 48230.5,
  open_count: 23,
  late_amount: 17640,
  late_count: 9,
  promised_amount: 5250.5,
  promised_count: 3,
  billed_90_days: 61800,
  aging: [6820, 5400, 1600, 3820],
  at_risk: [
    {
      id: "00000000-0000-4000-8000-000000000118",
      number: "F-2026-0118",
      amount_ttc: 3820,
      currency: "EUR",
      due_at: "2026-06-12",
      debtor_id: "00000000-0000-4000-8000-000000000001",
      debtor_name: "Menuiserie Caradec & Fils",
      risk_score: 78,
    },
    {
      id: "00000000-0000-4000-8000-000000000131",
      number: "F-2026-0131",
      amount_ttc: 1600,
      currency: "EUR",
      due_at: "2026-07-08",
      debtor_id: "00000000-0000-4000-8000-000000000004",
      debtor_name: "Dominique Lefort",
      risk_score: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000142",
      number: "F-2026-0142",
      amount_ttc: 4280,
      currency: "EUR",
      due_at: "2026-08-12",
      debtor_id: "00000000-0000-4000-8000-000000000002",
      debtor_name: "Studio Brume",
      risk_score: 41,
    },
    {
      id: "00000000-0000-4000-8000-000000000156",
      number: "F-2026-0156",
      amount_ttc: 640,
      currency: "EUR",
      due_at: "2026-09-10",
      debtor_id: "00000000-0000-4000-8000-000000000003",
      debtor_name: "Boulangerie Lenoir SAS",
      risk_score: 12,
    },
  ],
});

const at = (time: string) => `${TODAY}T${time}:00Z`;

const DATA: DashboardData | null = SUMMARY && {
  summary: SUMMARY,
  todo: { awaitingApproval: 2, repliesToHandle: 3, failedReminders: 1 },
  activity: [
    {
      id: 5,
      createdAt: at("09:12"),
      actor: "Assistant IA",
      description: "Réponse du client reçue (contestation) · relances en pause",
      link: { href: "/design/reponses", label: "Voir la facture" },
    },
    {
      id: 4,
      createdAt: at("08:31"),
      actor: "Relia (automatique)",
      description: "Relance envoyée depuis la boîte d'envoi",
      link: { href: "/design/relances", label: "Voir la facture" },
    },
    { id: 3, createdAt: at("07:40"), actor: "Camille Démo", description: "Relance validée", link: null },
    {
      id: 2,
      createdAt: at("07:02"),
      actor: "Relia (automatique)",
      description: "Relance préparée, en attente de validation",
      link: null,
    },
    { id: 1, createdAt: at("06:58"), actor: "Relia (automatique)", description: "Promesse non tenue : relances reprises", link: null },
  ],
};

export default function DashboardDemoPage() {
  if (isProductionDeployment() || !DATA) notFound();

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader title="Bonjour Camille" description="Démonstration du palier 12, sans base de données." />
      <DashboardView data={DATA} today={TODAY} />
    </AppShell>
  );
}
