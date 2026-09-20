import { ChevronRight, Inbox, MessageSquareReply, SendHorizontal, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardTodo } from "@/lib/data/dashboard";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";

type TodoItem = { key: string; href: string; icon: LucideIcon; label: ReactNode; isUrgent?: boolean };

/** Un nombre en avant, puis ce qu'il compte : « 3 relances à valider ». */
const counted = (count: number, singular: string, plural: string) => (
  <>
    <span className="font-semibold tabular-nums">{count}</span> {pluralize(count, singular, plural)}
  </>
);

/** Ce qui attend une décision du client : validations, réponses, envois en échec, réglage manquant. */
export function TodoList({ todo }: { todo: DashboardTodo }) {
  const countedItems: (TodoItem & { count: number })[] = [
    {
      key: "replies",
      count: todo.repliesToHandle,
      href: "/app/reponses",
      icon: MessageSquareReply,
      label: counted(todo.repliesToHandle, "réponse de client à traiter", "réponses de clients à traiter"),
    },
    {
      key: "approval",
      count: todo.awaitingApproval,
      href: "/app/relances",
      icon: SendHorizontal,
      label: counted(todo.awaitingApproval, "relance à valider", "relances à valider"),
    },
    {
      key: "failed",
      count: todo.failedReminders,
      href: "/app/relances?statut=echecs",
      icon: TriangleAlert,
      label: counted(todo.failedReminders, "envoi en échec", "envois en échec"),
      isUrgent: true,
    },
  ];
  const items: TodoItem[] = countedItems.filter((item) => item.count > 0);

  // Sans serveur IMAP, les relances partent mais aucune réponse n'est entendue : ni promesse
  // détectée, ni mise en pause. Le réglage est facultatif à la connexion, donc facile à manquer.
  if (todo.isMissingReplyReading) {
    items.push({
      key: "imap",
      href: "/app/boite-mail",
      icon: Inbox,
      label: "Les réponses de vos clients ne sont pas lues : ajoutez votre serveur IMAP",
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-fg-muted">Rien ne vous attend. Relia s&apos;occupe du reste.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map(({ key, href, icon: Icon, label, isUrgent }) => (
        <li key={key}>
          <Link
            href={href}
            className="group flex items-center gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2.5 transition-colors duration-hover hover:border-glow hover:bg-surface"
          >
            <Icon aria-hidden className={cn("size-4 shrink-0", isUrgent ? "text-danger" : "text-link")} />
            <span className="flex-1 text-sm text-fg">{label}</span>
            <ChevronRight aria-hidden className="size-4 text-fg-muted transition-transform duration-hover group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
