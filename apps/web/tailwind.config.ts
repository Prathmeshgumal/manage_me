import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // shadcn semantic tokens (mapped to Signal palette via CSS vars)
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        // Signal-specific tokens
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: { DEFAULT: "var(--ink)", muted: "var(--ink-muted)" },
        priority: {
          urgent: "var(--p-urgent)", high: "var(--p-high)", medium: "var(--p-medium)",
          low: "var(--p-low)", none: "var(--p-none)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        pulseSpine: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
      },
      animation: { spine: "pulseSpine 2.4s ease-in-out infinite" },
    },
  },
  plugins: [animate],
} satisfies Config;
