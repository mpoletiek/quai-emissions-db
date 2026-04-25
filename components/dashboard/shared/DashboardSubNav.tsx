"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Sub-navigation strip rendered below the global TopNav, only on /dashboard/*
// pages. Lists the five dashboard surfaces (per docs/dashboard-proposal.md
// §3 site map). Independent from TopNav's "History"/"Live" tabs which point
// at the legacy v1 pages — those continue to work in parallel.

const TABS = [
  { href: "/dashboard", label: "Home", exact: true },
  { href: "/dashboard/mining", label: "Mining" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/live", label: "Live" },
];

export function DashboardSubNav() {
  const pathname = usePathname();
  return (
    <div
      className="border-b"
      style={{
        background: "var(--nav-bg)",
        borderColor: "var(--nav-border)",
      }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-4 py-1.5 md:px-8">
        {TABS.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname === t.href || (pathname?.startsWith(t.href + "/") ?? false);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1 text-sm transition",
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
    </div>
  );
}
