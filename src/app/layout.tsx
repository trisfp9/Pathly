import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Caveat } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pathly — Your Roadmap to the School of Your Dreams",
  description:
    "AI-powered college admissions assistant for high school students. Get personalized guidance on extracurriculars, college selection, and applications.",
  keywords: ["college admissions", "high school", "extracurriculars", "AI counselor"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable} ${caveat.variable}`}>
      <body className="font-body antialiased">
        {children}
        <SpeedInsights />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#141929",
              color: "#F0F0F0",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "10px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#8B5CF6", secondary: "#080E1A" },
            },
            error: {
              iconTheme: { primary: "#FF6B6B", secondary: "#0A0F1E" },
            },
          }}
        />
      </body>
    </html>
  );
}
