import type { Config } from "tailwindcss";

/** Resolve a CSS custom property (space-separated RGB channels) as a Tailwind colour.
 *  Going through <alpha-value> keeps opacity modifiers like `bg-civic/10` working. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: token("paper"),
        surface: {
          DEFAULT: token("surface"),
          2: token("surface-2"),
          3: token("surface-3"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        ink: {
          DEFAULT: token("ink"),
          soft: token("ink-soft"),
        },
        muted: token("muted"),
        subtle: token("subtle"),
        civic: {
          DEFAULT: token("civic"),
          strong: token("civic-strong"),
        },
        "on-civic": token("on-civic"),
        amber: token("amber"),
        success: token("success"),
        "success-bg": token("success-bg"),
        warning: token("warning"),
        "warning-bg": token("warning-bg"),
        danger: token("danger"),
        "danger-bg": token("danger-bg"),
        info: token("info"),
        "info-bg": token("info-bg"),

        /* Legacy aliases kept so existing utilities (bg-mint, cream, civic) still resolve. */
        mint: token("surface-3"),
        cream: token("paper"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "var(--radius-lg)",
        panel: "var(--radius-xl)",
      },
      boxShadow: {
        card: "var(--shadow-sm)",
        raised: "var(--shadow-md)",
        float: "var(--shadow-lg)",
      },
      transitionTimingFunction: {
        civic: "var(--ease)",
      },
    },
  },
  plugins: [],
} satisfies Config;
