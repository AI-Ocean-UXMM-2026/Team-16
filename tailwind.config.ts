import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ocean: { 50: "#eff6ff", 100: "#dbeafe", 500: "#2563eb", 600: "#1d4ed8", 700: "#1d4ed8" },
      },
      fontFamily: { sans: ["var(--font-inter)", "Arial", "sans-serif"], mono: ["var(--font-mono)", "monospace"] },
      boxShadow: { subtle: "0 1px 2px rgb(15 23 42 / 0.04)" },
    },
  },
  plugins: [],
};

export default config;
