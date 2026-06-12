/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: "#0a0a0f",
          800: "#12121a",
          700: "#1a1a26",
          600: "#242436",
          500: "#2e2e44",
        },
        accent: {
          DEFAULT: "#6366f1",
          light: "#818cf8",
          dim: "#4f46e5",
        },
        success: "#22c55e",
        danger: "#ef4444",
        warn: "#f59e0b",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 4s linear infinite",
        fadein: "fadeIn 0.3s ease forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
