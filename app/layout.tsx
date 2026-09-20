import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { BackgroundGlow } from "@/components/layout/BackgroundGlow";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast/ToastProvider";
import "./globals.css";

// next/font auto-héberge les polices au build : aucun appel à Google depuis le navigateur.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Relia — relance automatisée de vos factures",
    template: "%s · Relia",
  },
  description:
    "Relia relance vos factures impayées depuis votre propre boîte e-mail, avec le ton juste, pour que vous n'ayez plus à le faire.",
  applicationName: "Relia",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonce de la politique de sécurité du contenu, posé par le middleware pour cette requête.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="font-sans text-fg">
        <ThemeProvider nonce={nonce}>
          <ToastProvider>
            <BackgroundGlow />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
