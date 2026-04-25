import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { TopNav } from "@/components/layout/TopNav";
import {
  ThemeProvider,
  THEME_INIT_SCRIPT,
} from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "Quai Emissions Dashboard",
  description:
    "Live and historical Quai & Qi token emissions on Quai Network (cyprus1).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before React hydration so the correct `dark` class is on
            <html> before any paint — eliminates the flash-of-wrong-theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <QueryProvider>
            <TopNav />
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
