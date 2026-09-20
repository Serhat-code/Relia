import { ChevronRight, MessageSquareReply, SendHorizontal, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { DashboardTodo } from "@/lib/data/dashboard";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";

type TodoItem = { count: number; href: string; icon: LucideIcon; singular: string; plural: string; isUrgent?: boolean };

/** Ce qui attend une décision du client : validations, réponses, envois en échec. */
export function TodoList({ todo }: { todo: DashboardTodo }) {
  const items: TodoItem[] = [
    {
      count: todo.repliesToHandle,
      href: "/app/reponses",
      icon: MessageSquareReply,
      singular: "réponse de client à traiter",
      plural: "réponses de clients à traiter",
    },
    {
      count: todo.awaitingApproval,
      href: "/app/relances",
      icon: SendHorizontal,
      singular: "relance à valider",
      plural: "relances à valider",
    },
    {
      count: todo.failedReminders,
      href: "/app/relances?statut=echecs",
      icon: TriangleAlert,
      singular: "envoi en échec",
      plural: "envois en échec",
      isUrgent: true,
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) {
    return <p className="text-sm text-fg-muted">Rien ne vous attend. Relia s&apos;occupe du reste.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map(({ count, href, icon: Icon, singular, plural, isUrgent }) => (
        <li key={href}>
          <Link
            href={href}
            className="group flex items-center gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2.5 transition-colors duration-hover hover:border-glow hover:bg-surface"
          >
            <Icon aria-hidden className={cn("size-4 shrink-0", isUrgent ? "text-danger" : "text-link")} />
            <span className="flex-1 text-sm text-fg">
              <span className="font-semibold tabular-nums">{count}</span> {pluralize(count, singular, plural)}
            </span>
            <ChevronRight aria-hidden className="size-4 text-fg-muted transition-transform duration-hover group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
