import type { ReactNode } from "react";
import { DashboardSubNav } from "@/components/dashboard/shared/DashboardSubNav";

// /dashboard layout — wraps the new dashboard surfaces (home, tokenomics,
// mining, history, live) with a shared sub-nav. The legacy /history and
// /live pages are unaffected and continue to render under the root layout.

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DashboardSubNav />
      {children}
    </>
  );
}
