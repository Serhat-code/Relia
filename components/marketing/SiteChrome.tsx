import Link from "next/link";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonClasses } from "@/components/ui/button-styles";

const NAV_LINKS = [
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/#engagements", label: "Engagements" },
  { href: "/tarifs", label: "Tarifs" },
] as const;

/** En-tête des pages publiques : marque, navigation, connexion et essai gratuit. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Relia, accueil">
          <ReliaMark size={28} isDecorative />
          <span className="font-display text-lg font-semibold">Relia</span>
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-7 text-sm font-medium md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-fg-muted transition-colors duration-hover hover:text-fg">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/connexion" className="hidden px-3 text-sm font-medium text-fg-muted transition-colors duration-hover hover:text-fg sm:inline">
            Connexion
          </Link>
          <Link href="/inscription" className={buttonClasses({ size: "sm" })}>
            Essai gratuit
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Produit",
    links: [
      { href: "/#fonctionnement", label: "Fonctionnement" },
      { href: "/tarifs", label: "Tarifs" },
      { href: "/inscription", label: "Essai gratuit" },
      { href: "/connexion", label: "Connexion" },
    ],
  },
  {
    title: "Données et conformité",
    links: [
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/dpa", label: "Accord de sous-traitance (DPA)" },
      { href: "/sous-traitants", label: "Sous-traitants" },
    ],
  },
  {
    title: "Informations légales",
    links: [
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/cgu", label: "Conditions générales" },
    ],
  },
] as const;

/** Pied de page : liens utiles et rappel de ce que Relia est — un outil, jamais un intermédiaire. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-elevated/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <ReliaMark size={24} isDecorative />
            <span className="font-display text-base font-semibold">Relia</span>
          </Link>
          <p className="max-w-xs text-sm text-fg-muted">
            Un outil de relance : vos relances partent de votre boîte, vos clients vous répondent et vous paient directement.
          </p>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.14em] text-fg-muted uppercase">{column.title}</p>
            <ul className="flex flex-col gap-2 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-fg-muted transition-colors duration-hover hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-6xl border-t border-border px-4 py-6 text-xs text-fg-muted sm:px-8">
        © {new Date().getFullYear()} Relia · Données hébergées dans l&apos;Union européenne, à Paris.
      </p>
    </footer>
  );
}
