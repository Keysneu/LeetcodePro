import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0f172a",
        panel: "#111827",
        accent: "#22c55e"
      }
    }
  },
  plugins: []
};

export default config;
