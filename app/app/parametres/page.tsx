import type { Metadata } from "next";
import { BillingSituationText, PlanUsageText } from "@/components/billing/BillingStatus";
import { PlanCards } from "@/components/billing/PlanCards";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { CheckoutButton, PortalButton } from "@/components/settings/BillingActions";
import { DangerZone } from "@/components/settings/DangerZone";
import { OrganizationForm, RetentionForm } from "@/components/settings/OrganizationForms";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/billing/access";
import { isPaidPlan, PLANS } from "@/lib/billing/plans";
import { TeamInvitations } from "@/components/settings/TeamInvitations";
import { listPendingInvitations } from "@/lib/data/invitations";
import { getPlanUsage } from "@/lib/data/plan-usage";
import { listTeam, type TeamMember } from "@/lib/data/organization-settings";
import { requireMember } from "@/lib/data/session";
import { formatDate } from "@/lib/format";
import { firstValue, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Paramètres" };

const ROLE_LABELS: Readonly<Record<TeamMember["role"], string>> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};

const CHECKOUT_MESSAGES: Readonly<Record<string, { tone: "success" | "info"; text: string }>> = {
  merci: { tone: "success", text: "Merci ! Votre abonnement s'active : cela prend quelques secondes." },
  annule: { tone: "info", text: "Paiement annulé : rien n'a été débité." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [member, team, invitations, params] = await Promise.all([
    requireMember(),
    listTeam(),
    listPendingInvitations(),
    searchParams,
  ]);
  // Le décompte n'a de sens qu'une fois une offre choisie : pendant l'essai, aucune limite.
  const paidPlan = isPaidPlan(member.organization.plan) ? member.organization.plan : null;
  const usage = paidPlan ? await getPlanUsage() : null;
  const organization = member.organization;
  const canManage = member.role !== "member";
  const status = organization.billing.subscriptionStatus;
  const isSubscribed = status !== null && ACTIVE_SUBSCRIPTION_STATUSES.has(status);
  const checkoutMessage = CHECKOUT_MESSAGES[firstValue(params.abonnement)];
  const currentPlan = isSubscribed && isPaidPlan(organization.plan) ? organization.plan : null;

  return (
    <>
      <PageHeader title="Paramètres" description="Abonnement, organisation, conservation des données et équipe." />
      <div className="flex flex-col gap-6">
        {checkoutMessage && (
          <Reveal index={1}>
            <FormMessage tone={checkoutMessage.tone}>{checkoutMessage.text}</FormMessage>
          </Reveal>
        )}

        <Reveal index={1}>
          <section id="abonnement" aria-labelledby="abonnement-titre" className="flex scroll-mt-24 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 id="abonnement-titre" className="font-display text-xl font-semibold">
                  Abonnement
                </h2>
                <p className="max-w-2xl text-sm text-fg-muted">
                  <BillingSituationText organization={organization} />
                </p>
                {paidPlan && usage && <PlanUsageText plan={paidPlan} usage={usage} />}
              </div>
              {canManage && organization.billing.hasStripeCustomer && <PortalButton />}
            </div>
            <PlanCards
              plans={PLANS}
              currentPlan={currentPlan}
              actions={
                canManage && !isSubscribed
                  ? Object.fromEntries(PLANS.map((plan) => [plan.id, <CheckoutButton key={plan.id} plan={plan.id} isHighlighted={Boolean(plan.isHighlighted)} />]))
                  : {}
              }
            />
            <p className="text-xs text-fg-muted">
              Paiement mensuel par carte, sans engagement, géré par Stripe : Relia ne voit jamais vos coordonnées bancaires.
              {!canManage && " Seuls le propriétaire et les administrateurs peuvent gérer l'abonnement."}
            </p>
          </section>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal index={2}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Organisation</CardTitle>
                <CardDescription>Le nom et le SIREN qui signent vos relances.</CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationForm name={organization.name} siren={organization.siren} currency={organization.defaultCurrency} canManage={canManage} />
              </CardContent>
            </Card>
          </Reveal>
          <Reveal index={3}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Conservation des données</CardTitle>
                <CardDescription>
                  Passé ce délai après la clôture d&apos;une facture, Relia efface automatiquement la facture, ses relances et
                  les réponses du client (RGPD). Votre comptabilité, elle, reste chez vous.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RetentionForm months={organization.retentionMonths} canManage={canManage} />
              </CardContent>
            </Card>
          </Reveal>
        </div>

        <Reveal index={4}>
          <Card>
            <CardHeader>
              <CardTitle>Équipe</CardTitle>
              <CardDescription>Les personnes qui ont accès aux factures et aux relances de votre organisation.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {team.map((person) => (
                  <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-fg">
                        {person.name ?? person.email}
                        {person.id === member.id && <span className="font-normal text-fg-muted"> (vous)</span>}
                      </span>
                      <span className="truncate text-xs text-fg-muted">
                        {person.email} · depuis le {formatDate(person.joinedAt)}
                      </span>
                    </div>
                    <Badge tone={person.role === "owner" ? "accent" : "neutral"}>{ROLE_LABELS[person.role]}</Badge>
                  </li>
                ))}
              </ul>
              <TeamInvitations
                invitations={invitations.map((invitation) => ({
                  id: invitation.id,
                  email: invitation.email,
                  role: invitation.role,
                  expiresAt: invitation.expiresAt,
                }))}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </Reveal>

        {member.role === "owner" && (
          <Reveal index={5}>
            <DangerZone organizationName={organization.name} />
          </Reveal>
        )}
      </div>
    </>
  );
}
