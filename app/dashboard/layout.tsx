import type { ReactNode } from "react";

// /dashboard layout — kept for symmetry with possible per-surface metadata
// or providers. The dashboard tab strip is rendered inline inside TopNav
// (Phase 1 collapsed the two stacked bars into one).

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
