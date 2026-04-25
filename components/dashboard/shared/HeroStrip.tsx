"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// HeroStrip — the 3–4 KPI cards that lead every page in the new dashboard.
// One card is visually dominant (larger type, accent border); the rest are
// supporting. This enforces the design rule from docs/dashboard-proposal.md
// §4: avoid 6 equal-weight cards, give the eye a primary number.
//
// Layout: dominant card spans 2 cols on md+; supporting cards each take 1.
// On mobile (< 640px), all stack vertically with the dominant first.

export type HeroCard = {
  /** Stable id for keying. */
  id: string;
  /** Short label above the value (e.g. "Realized circulating QUAI"). */
  label: string;
  /** The headline value. Pass a string for already-formatted output. Pass
   *  ReactNode for a value with units styled inline (e.g. "1.23 B QUAI"). */
  value: ReactNode;
  /** Optional sub-text below the value (one line; small, muted). */
  sub?: ReactNode;
  /** Optional delta tag ("+1.2% vs prior week"); rendered to the right. */
  delta?: { sign: "up" | "down" | "flat"; text: string };
  /** Loading skeleton if data not ready. */
  loading?: boolean;
};

export function HeroStrip({
  dominant,
  cards,
  className,
}: {
  dominant: HeroCard;
  /** 2 or 3 supporting cards. */
  cards: HeroCard[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        // Mobile: stack. md+: dominant spans 2, supporting fill remaining cols.
        "grid-cols-1",
        cards.length === 2 && "md:grid-cols-4",
        cards.length === 3 && "md:grid-cols-5",
        cards.length === 4 && "md:grid-cols-6",
        cards.length === 5 && "md:grid-cols-7",
        className,
      )}
    >
      <DominantCard card={dominant} />
      {cards.map((c) => (
        <SupportingCard key={c.id} card={c} />
      ))}
    </div>
  );
}

function DominantCard({ card }: { card: HeroCard }) {
  return (
    <div
      className={cn(
        "card md:col-span-2 relative overflow-hidden",
        "border-l-4 border-l-blue-500/70 dark:border-l-blue-400/70",
      )}
    >
      <div className="text-[0.7rem] uppercase tracking-wider text-slate-900/60 dark:text-white/60">
        {card.label}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        {card.loading ? (
          <div className="h-9 w-44 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {card.value}
          </div>
        )}
        {card.delta && <DeltaTag delta={card.delta} />}
      </div>
      {card.sub && (
        <div className="mt-1 text-xs text-slate-900/55 dark:text-white/55">
          {card.sub}
        </div>
      )}
    </div>
  );
}

function SupportingCard({ card }: { card: HeroCard }) {
  return (
    <div className="card">
      <div className="text-[0.7rem] uppercase tracking-wider text-slate-900/55 dark:text-white/55">
        {card.label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        {card.loading ? (
          <div className="h-6 w-24 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
        ) : (
          <div className="text-xl font-medium tracking-tight text-slate-900 dark:text-white">
            {card.value}
          </div>
        )}
        {card.delta && <DeltaTag delta={card.delta} compact />}
      </div>
      {card.sub && (
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          {card.sub}
        </div>
      )}
    </div>
  );
}

function DeltaTag({
  delta,
  compact = false,
}: {
  delta: NonNullable<HeroCard["delta"]>;
  compact?: boolean;
}) {
  // Color rules: up = emerald, down = dimmed slate (NOT red — red is for true
  // alerts only; routine "supply went down" should not look alarming).
  const color =
    delta.sign === "up"
      ? "text-emerald-600 dark:text-emerald-300"
      : delta.sign === "down"
        ? "text-slate-700 dark:text-white/70"
        : "text-slate-500 dark:text-white/40";
  return (
    <span
      className={cn(
        "rounded-full px-1.5 font-mono",
        compact ? "text-[0.65rem]" : "text-xs",
        color,
      )}
    >
      {delta.text}
    </span>
  );
}
