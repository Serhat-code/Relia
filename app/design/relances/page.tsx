import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { AutoSendToggle, PlanNowButton } from "@/components/reminders/QueueControls";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { LinkTabs } from "@/components/ui/LinkTabs";
import type { ReminderItem } from "@/lib/data/reminders";
import { isProductionDeployment } from "@/lib/env";

export const metadata: Metadata = { title: "Relances (démonstration)", robots: { index: false, follow: false } };

// Démonstration interne du palier 10 (sans base de données) : file de relances fictive.
const REMINDERS: ReminderItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    status: "awaiting_approval",
    scheduledAt: "2026-09-21T07:30:00Z",
    sentAt: null,
    subject: "Facture F-2026-0412 : règlement attendu",
    body: "Bonjour Yann,\n\nNotre facture F-2026-0412 de 4 820,00 € est arrivée à échéance le 11/08/2026 et reste impayée à ce jour. Pouvez-vous nous indiquer quand le règlement sera effectué ?\n\nSi un point de la facture pose question, répondez simplement à ce message.\n\nAtelier Démo",
    isAiGenerated: true,
    error: null,
    tone: "ferme",
    invoice: { id: "00000000-0000-4000-8000-000000000412", number: "F-2026-0412", amountTtc: 4820, currency: "EUR", dueAt: "2026-08-11" },
    debtor: { id: "00000000-0000-4000-8000-000000000001", name: "Menuiserie Caradec & Fils", clientType: "b2b", email: "compta@caradec.example" },
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    status: "awaiting_approval",
    scheduledAt: "2026-09-21T07:30:00Z",
    sentAt: null,
    subject: "Votre facture F-2026-0427",
    body: "Bonjour,\n\nNous nous permettons de vous rappeler que la facture n° F-2026-0427 d'un montant de 312,50 € est arrivée à échéance le 06/09/2026.\n\nSi vous l'avez déjà réglée, merci de ne pas tenir compte de ce message.\n\nBien cordialement,\nAtelier Démo",
    isAiGenerated: false,
    error: null,
    tone: "courtois",
    invoice: { id: "00000000-0000-4000-8000-000000000427", number: "F-2026-0427", amountTtc: 312.5, currency: "EUR", dueAt: "2026-09-06" },
    debtor: { id: "00000000-0000-4000-8000-000000000004", name: "Boulangerie Le Fournil", clientType: "b2c", email: "contact@fournil.example" },
  },
];

export default function RemindersDemoPage() {
  if (isProductionDeployment()) notFound();
  const tabs = [
    { label: "À valider", href: "/design/relances", count: 2, isActive: true },
    { label: "Planifiées", href: "/design/relances?statut=planifiees", count: 3, isActive: false },
    { label: "Envoyées", href: "/design/relances?statut=envoyees", count: 14, isActive: false },
    { label: "Échecs", href: "/design/relances?statut=echecs", count: 0, isActive: false },
  ];

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader
        title="Relances"
        description="Démonstration du palier 10, sans base de données."
        actions={<PlanNowButton />}
      />
      <div className="flex flex-col gap-6">
        <Reveal index={1} className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <LinkTabs tabs={tabs} label="Filtrer les relances" />
          <div className="lg:max-w-md">
            <AutoSendToggle isEnabled={false} canManage />
          </div>
        </Reveal>
        {REMINDERS.map((reminder, index) => (
          <Reveal key={reminder.id} index={index + 2}>
            <ReminderCard reminder={reminder} senderName="Atelier Démo" />
          </Reveal>
        ))}
      </div>
    </AppShell>
  );
}
