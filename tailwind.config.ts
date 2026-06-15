import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: "#27745f",
        line: "#f7f0d2",
        paddle: "#e9573f",
        ink: "#17211f"
      }
    }
  },
  plugins: []
};

export default config;
