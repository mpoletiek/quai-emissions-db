import type { Config } from "tailwindcss";

// Theme aligned with the Quai Network official surfaces (qu.ai, soap.qu.ai,
// docs.qu.ai). The brand is unmistakably **warm-dark**: near-black bg with
// a brown undertone, cream off-white text, brand red `#e22901` for primary
// signal, warm-amber accents. See globals.css for the matching CSS vars.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand red — primary signal color across qu.ai/soap.qu.ai/docs.qu.ai.
        // Anchored on `#e22901` (docs canonical) with `#c70000` for pressed.
        quai: {
          50:  "#fff1ed",
          100: "#ffdcd1",
          200: "#ffb8a3",
          300: "#ff8a6c",
          400: "#ff5c3d",
          500: "#e22901", // brand
          600: "#c70000", // hover/pressed
          700: "#a30000",
          800: "#7d0000",
          900: "#560000",
          950: "#330000",
        },
        // Warm amber accent — used around CTAs, eyebrow ticks, secondary signal.
        amber: {
          50:  "#fff6ee",
          100: "#feeadb",
          200: "#fdd1ad",
          300: "#f0a16d", // brand accent
          400: "#d77a40",
          500: "#a84f26", // accent deep
          600: "#823a18",
        },
        // Qi (the second token in the Quai dual-token system) keeps a green
        // identity but shifted slightly to harmonize with the warm palette.
        qi: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        // Surface palette — warm-tinted near-black with brown undertone.
        // Use these instead of slate/zinc for any panel-style surface.
        ink: {
          DEFAULT: "#0d0a0b", // page bg dark
          50:  "#f6e8dc",     // text primary on dark
          100: "#e6d3c2",
          200: "#d0b29e",     // text muted
          300: "#a8866d",
          400: "#785338",
          500: "#3e1c11",     // panel base
          600: "#25120d",     // surface raised
          700: "#170b07",     // canvas dark
          800: "#0d0a0b",     // page bg
          900: "#070506",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        // Signature hover/focus glow — `0 0 8px rgba(226,1,1,.45)` per brief.
        glow: "0 0 8px rgba(226, 41, 1, 0.45)",
        "glow-strong": "0 0 16px rgba(226, 41, 1, 0.55)",
        // Soft ambient panel shadow.
        panel: "0 30px 80px -30px rgba(0, 0, 0, 0.55)",
      },
    },
  },
  plugins: [],
};
export default config;
