import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { TopNav } from "@/components/layout/TopNav";
import {
  ThemeProvider,
  THEME_INIT_SCRIPT,
} from "@/components/providers/ThemeProvider";

// Brand-aligned fonts. Quai's official sites use Yapari (display) + Bai
// Jamjuree (body) + Monorama (mono) — none of which are open-licensed for
// embedding. The closest free substitutes preserve the tech-futurist feel:
//   • Space Grotesk — geometric display, similar weight curve to Yapari
//   • Inter         — the de facto humanist sans for product UI
//   • JetBrains Mono — terminal-flavored mono for data + eyebrow labels
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Runs before React hydration so the correct `dark` class is on
            <html> before any paint — eliminates the flash-of-wrong-theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">
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
