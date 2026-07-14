import type { Config } from "tailwindcss";
export default { content: ["./src/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#17362f", civic: "#16765e", mint: "#e7f3ee", cream: "#f7f6f0", amber: "#d79231" }, boxShadow: { card: "0 10px 30px rgba(23,54,47,.08)" } } }, plugins: [] } satisfies Config;
