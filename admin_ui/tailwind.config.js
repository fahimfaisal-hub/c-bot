/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FA",
        surface: "#FFFFFF",
        border: "#E3E6EB",
        "border-strong": "#CBD1DB",
        ink: "#14171F",
        "ink-muted": "#6B7280",
        "ink-faint": "#9AA1AE",
        signal: {
          DEFAULT: "#3454D1",
          hover: "#2A44AD",
          soft: "#EEF1FC",
        },
        good: {
          DEFAULT: "#16A34A",
          soft: "#E9F7EF",
        },
        warn: {
          DEFAULT: "#B45309",
          soft: "#FDF3E7",
        },
        bad: {
          DEFAULT: "#DC2626",
          soft: "#FDECEC",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 23, 31, 0.04), 0 1px 1px rgba(20, 23, 31, 0.03)",
        pop: "0 8px 24px rgba(20, 23, 31, 0.10)",
      },
    },
  },
  plugins: [],
}
