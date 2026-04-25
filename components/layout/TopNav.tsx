"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useHeadBlock } from "@/lib/hooks";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky top-0 z-10 border-b backdrop-blur"
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--nav-border)",
      }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-1 py-2">
          <Link
            href="/"
            className="mr-3 text-sm font-semibold tracking-tight text-slate-900 dark:text-white/90"
          >
            Quai Emissions
          </Link>
          {TABS.map((t) => {
            const active =
              pathname === t.href || (pathname?.startsWith(t.href + "/") ?? false);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition",
                  active
                    ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                    : "text-slate-700 hover:text-slate-900 dark:text-white/60 dark:hover:text-white/90",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3 py-2">
          <StatusCluster />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function StatusCluster() {
  const { data, error, isLoading } = useHeadBlock();
  const hasData = !!data && typeof data.headBlock === "number";
  const dotClass = error
    ? "bg-amber-400"
    : hasData
      ? data.lagBlocks > 100
        ? "bg-amber-400"
        : "bg-emerald-400"
      : "bg-slate-400 dark:bg-white/20";
  const text = error
    ? "status unknown"
    : isLoading
      ? "loading…"
      : hasData
        ? data.lagBlocks === 0
          ? `head #${data.headBlock.toLocaleString()} · synced`
          : `head #${data.headBlock.toLocaleString()} · ${data.lagBlocks.toLocaleString()} behind`
        : "awaiting /api/health";
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/50">
      <span
        className={cn("inline-block h-2 w-2 rounded-full", dotClass)}
        aria-hidden
      />
      <span className="hidden md:inline">{text}</span>
    </div>
  );
}
