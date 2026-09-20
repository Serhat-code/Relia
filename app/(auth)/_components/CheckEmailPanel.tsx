import { MailCheck } from "lucide-react";
import Link from "next/link";

/** Confirmation d'envoi : même message qu'un compte existe ou non. */
export function CheckEmailPanel({ message }: { message: string }) {
  return (
    <div role="status" className="flex flex-col items-start gap-4">
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-elevated">
        <MailCheck aria-hidden className="size-5 text-link" />
      </span>
      <h2 className="text-lg font-semibold">Vérifiez votre boîte e-mail</h2>
      <p className="text-sm text-fg-muted">{message}</p>
      <p className="text-sm text-fg-muted">
        Rien reçu ? Regardez dans les indésirables, ou{" "}
        <Link href="/connexion" className="font-medium text-link underline-offset-4 hover:underline">
          revenez à la connexion
        </Link>
        .
      </p>
    </div>
  );
}
