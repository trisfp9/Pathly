import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080E1A",     // Midnight blue
        surface: "#111827",
        accent: "#00B4D8",         // Electric teal — modern, clean
        "accent-deep": "#0090B0",  // Deeper teal
        pop: "#FF8C42",            // Warm orange — energy, motivation
        "pop-light": "#FFB07A",    // Lighter orange
        energy: "#FF8C42",         // Orange — creativity, energy
        "energy-light": "#FFB07A",
        "energy-warm": "#FFCF9C",  // Soft warm
        purple: "#8B5CF6",         // Vivid purple — premium, modern
        "purple-light": "#A855F7",
        "purple-deep": "#7C3AED",
        gold: "#FFD700",           // Gold sparkle
        "text-primary": "#F1F5F9",
        "text-muted": "#94A3B8",
      },
      fontFamily: {
        heading: ["var(--font-plus-jakarta)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        handwritten: ["var(--font-caveat)", "cursive"],
      },
      borderRadius: {
        card: "16px",
        button: "10px",
        badge: "999px",
      },
      animation: {
        "meteor-effect": "meteor 5s linear infinite",
      },
      keyframes: {
        meteor: {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
          "70%": { opacity: "1" },
          "100%": {
            transform: "rotate(215deg) translateX(-500px)",
            opacity: "0",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
