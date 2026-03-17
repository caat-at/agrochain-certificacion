import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        verde: {
          50:  "#f0faf4",
          100: "#d8f3e4",
          500: "#1a7f4b",
          600: "#166b3f",
          700: "#115533",
        },
      },
    },
  },
  plugins: [],
};

export default config;
