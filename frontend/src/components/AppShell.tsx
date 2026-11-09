"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/profile", label: "Profile", short: "Profile" },
  { href: "/matches", label: "Today's matches", short: "Matches" },
];

/** Frame for signed-in pages: the glass top bar, a soft dusk glow, and a page title. */
export default function AppShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    router.push("/");
  }

  return (
    <div className="relative isolate min-h-[100svh] bg-mist text-ink">
      <div className="app-glow -z-10" aria-hidden="true" />
      <div className="px-4 pt-5 sm:px-8 lg:px-14">
        <nav className="glass-light mx-auto flex max-w-[120rem] items-center justify-between gap-3 rounded-[1.4rem] py-2.5 pl-4 pr-2.5 sm:py-3 sm:pl-7 sm:pr-3">
          <Link href="/" aria-label="PlaceMates home"><Logo large /></Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:px-4 sm:text-[0.95rem] ${path === l.href
                  ? "bg-violet text-white" : "text-ink hover:bg-white/70"}`}>
                <span className="sm:hidden">{l.short}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            ))}
            <button onClick={signOut} className="hidden rounded-xl px-4 py-2 text-[0.95rem] font-medium text-ink-soft hover:bg-white/70 hover:text-ink sm:block">
              Sign out
            </button>
          </div>
        </nav>
      </div>

      <main className="mx-auto max-w-[120rem] px-5 pb-20 pt-12 sm:px-8 lg:px-[5.25rem] lg:pt-16">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">{title}</h1>
            {subtitle && <p className="mt-3 max-w-2xl text-lg text-ink-soft">{subtitle}</p>}
          </div>
          {actions}
        </header>
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}
