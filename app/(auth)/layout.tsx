import { Mail, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const PROMISES = [
  { icon: Mail, text: "Vos relances partent de votre propre boîte e-mail, à votre nom." },
  { icon: ShieldCheck, text: "Données hébergées dans l'Union européenne, à Paris, cloisonnées et chiffrées." },
  { icon: Sparkles, text: "Rédaction assistée par IA, toujours validée par vous avant le premier envoi." },
] as const;

function Wordmark() {
  return (
    <Link href="/" className="flex w-fit items-center gap-2.5">
      <ReliaMark size={28} isDecorative />
      <span className="font-display text-lg font-semibold">Relia</span>
    </Link>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
      <aside className="hidden flex-col justify-between border-r border-border bg-elevated/40 p-12 lg:flex">
        <Wordmark />
        <div className="max-w-md">
          <p className="font-display text-2xl leading-tight font-semibold">
            La relance de vos factures, <span className="text-gradient-brand">sans la gêne.</span>
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-fg-muted">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-link" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="max-w-md text-xs text-fg-muted">
          Relia est un outil de relance : vous restez l&apos;expéditeur, et vos clients vous règlent directement.
        </p>
      </aside>

      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="lg:invisible">
            <Wordmark />
          </div>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
      </main>
    </div>
  );
}
