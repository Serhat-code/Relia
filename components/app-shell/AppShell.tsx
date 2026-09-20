import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileNav } from "./MobileNav";
import { SidebarNav } from "./Sidebar";

export type ShellMember = {
  organizationName: string;
  userName: string;
  userEmail: string;
};

function Wordmark() {
  return (
    <Link href="/app" className="flex w-fit items-center gap-2.5 px-1">
      <ReliaMark size={26} isDecorative />
      <span className="font-display text-lg font-semibold">Relia</span>
    </Link>
  );
}

function MemberPanel({ member }: { member: ShellMember }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="min-w-0 px-1">
        <p className="truncate text-sm font-medium text-fg">{member.organizationName}</p>
        <p className="truncate text-xs text-fg-muted">{member.userName || member.userEmail}</p>
      </div>
      <div className="flex items-center gap-2">
        <form action={signOutAction} className="flex-1">
          <button
            type="submit"
            className="inline-flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-fg-muted transition duration-hover hover:bg-surface/60 hover:text-fg"
          >
            <LogOut aria-hidden className="size-4" />
            Se déconnecter
          </button>
        </form>
        <ThemeToggle />
      </div>
    </div>
  );
}

/** Cadre de l'application connectée : barre latérale (bureau) ou menu déroulant (mobile). */
export function AppShell({ member, children }: { member: ShellMember; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-border bg-elevated/40 px-4 py-6 lg:flex">
        <Wordmark />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <MemberPanel member={member} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
        <Wordmark />
        <MobileNav footer={<MemberPanel member={member} />} />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-12">{children}</main>
    </div>
  );
}
