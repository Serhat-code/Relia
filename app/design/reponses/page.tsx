import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { ReplyCard } from "@/components/replies/ReplyCard";
import { CheckRepliesButton } from "@/components/replies/ReplyControls";
import { LinkTabs } from "@/components/ui/LinkTabs";
import type { ReplyItem } from "@/lib/data/replies";
import { isProductionDeployment } from "@/lib/env";

export const metadata: Metadata = { title: "Réponses (démonstration)", robots: { index: false, follow: false } };

const TODAY = "2026-09-21";

// Démonstration interne du palier 11 (sans base de données) : réponses fictives de clients.
const REPLIES: ReplyItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    kind: "dispute",
    status: "new",
    receivedAt: "2026-09-21T08:42:00Z",
    excerpt:
      "Bonjour, nous ne réglerons pas cette facture en l'état : la pose des menuiseries du 2e étage n'est pas terminée. Merci de nous envoyer une facture pour la partie réalisée.",
    isAiClassified: true,
    handledAt: null,
    invoice: {
      id: "00000000-0000-4000-8000-000000000412",
      number: "F-2026-0412",
      amountTtc: 4820,
      currency: "EUR",
      dueAt: "2026-08-11",
      status: "late",
      isPaused: true,
    },
    debtor: { id: "00000000-0000-4000-8000-000000000001", name: "Menuiserie Caradec & Fils", email: "compta@caradec.example" },
    promise: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    kind: "paid_claim",
    status: "new",
    receivedAt: "2026-09-21T07:55:00Z",
    excerpt: "Bonjour, le virement est parti vendredi dernier, vous devriez l'avoir reçu. Bonne journée.",
    isAiClassified: true,
    handledAt: null,
    invoice: {
      id: "00000000-0000-4000-8000-000000000156",
      number: "F-2026-0156",
      amountTtc: 640,
      currency: "EUR",
      dueAt: "2026-09-10",
      status: "late",
      isPaused: true,
    },
    debtor: { id: "00000000-0000-4000-8000-000000000004", name: "Dominique Lefort", email: "dominique.lefort@particulier.example" },
    promise: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    kind: "other",
    status: "new",
    receivedAt: "2026-09-20T16:10:00Z",
    excerpt: "Pouvez-vous me renvoyer votre RIB ? Je n'arrive pas à remettre la main sur la facture.",
    isAiClassified: false,
    handledAt: null,
    invoice: {
      id: "00000000-0000-4000-8000-000000000170",
      number: "F-2026-0170",
      amountTtc: 1800,
      currency: "EUR",
      dueAt: "2026-09-15",
      status: "late",
      isPaused: true,
    },
    debtor: { id: "00000000-0000-4000-8000-000000000002", name: "Studio Brume", email: "hello@brume.example" },
    promise: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    kind: "promise",
    status: "new",
    receivedAt: "2026-09-19T09:12:00Z",
    excerpt: "Bonjour, je vous règle le solde le 30/09 par virement. Désolé pour le retard.",
    isAiClassified: true,
    handledAt: null,
    invoice: {
      id: "00000000-0000-4000-8000-000000000151",
      number: "F-2026-0151",
      amountTtc: 1250.5,
      currency: "EUR",
      dueAt: "2026-09-02",
      status: "promised",
      isPaused: false,
    },
    debtor: { id: "00000000-0000-4000-8000-000000000003", name: "Cabinet Voisin", email: "compta@voisin.example" },
    promise: { date: "2026-09-30", amount: null, kept: null },
  },
];

export default function RepliesDemoPage() {
  if (isProductionDeployment()) notFound();
  const tabs = [
    { label: "À traiter", href: "/design/reponses", count: 4, isActive: true },
    { label: "Traitées", href: "/design/reponses?statut=traitees", count: 11, isActive: false },
  ];

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader
        title="Réponses"
        description="Démonstration du palier 11, sans base de données."
        actions={<CheckRepliesButton />}
      />
      <div className="flex flex-col gap-6">
        <Reveal index={1}>
          <LinkTabs tabs={tabs} label="Filtrer les réponses" />
        </Reveal>
        {REPLIES.map((reply, index) => (
          <Reveal key={reply.id} index={index + 2}>
            <ReplyCard reply={reply} today={TODAY} />
          </Reveal>
        ))}
      </div>
    </AppShell>
  );
}
