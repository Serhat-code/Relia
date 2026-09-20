import { HandCoins, Sparkles } from "lucide-react";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { Badge } from "@/components/ui/Badge";

/**
 * Aperçu du produit (décoratif, entièrement en HTML) : une relance qui part de l'adresse du client,
 * puis la réponse de son client, lue par Relia, et la promesse notée. Tout le sens est repris dans le
 * texte de la page : l'ensemble est masqué aux lecteurs d'écran.
 */
export function HeroVisual() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-lg select-none lg:mx-0">
      <div className="pointer-events-none absolute -inset-16 rounded-full bg-gradient-glow blur-2xl" />

      <div className="relative animate-page-in rounded-2xl border border-border bg-elevated p-5 shadow-raised motion-reduce:animate-none">
        <div className="flex flex-col gap-1 border-b border-border pb-3 text-xs text-fg-muted">
          <p>
            <span className="text-fg-subtle">De</span> <span className="text-fg">Vous</span> &lt;vous@votre-entreprise.fr&gt;
          </p>
          <p>
            <span className="text-fg-subtle">Objet</span> <span className="font-medium text-fg">Facture F-2026-0412 : règlement attendu</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 py-4 text-sm leading-relaxed text-fg">
          <p>Bonjour Yann,</p>
          <p className="text-fg-muted">
            Notre facture F-2026-0412 de <span className="text-fg tabular-nums">4 820,00 €</span> est arrivée à échéance le
            11/08. Pouvez-vous nous indiquer quand le règlement sera effectué ?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning">Ferme</Badge>
          <Badge tone="accent">
            <Sparkles className="size-3" />
            Message assisté par IA
          </Badge>
        </div>
      </div>

      <div
        className="relative mt-4 ml-8 animate-page-in rounded-2xl border border-glow bg-surface p-4 shadow-halo motion-reduce:animate-none sm:ml-16"
        style={{ animationDelay: "160ms" }}
      >
        <p className="text-sm text-fg">« Bonjour, je vous règle le 30/09 par virement. »</p>
        <p className="mt-1 text-xs text-fg-muted">Réponse de Yann, lue par Relia</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Badge tone="success">
            <HandCoins className="size-3" />
            Promesse de règlement · 30/09
          </Badge>
          <span className="text-xs text-fg-muted">Relances en pause jusqu&apos;à cette date</span>
        </div>
      </div>

      <div
        className="absolute -top-5 right-2 flex animate-page-in items-center gap-2 rounded-full border border-border bg-elevated px-3 py-1.5 text-xs font-medium shadow-raised motion-reduce:animate-none sm:-right-4"
        style={{ animationDelay: "320ms" }}
      >
        <ReliaMark size={18} stage="promised" isDecorative />
        Promesse obtenue
      </div>
    </div>
  );
}
