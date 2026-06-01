import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "KARTABUMI — Peta & Distribusi SPPT PBB",
  description: "Aplikasi Pemetaan Bidang Tanah & Pelacakan Distribusi SPPT PBB-P2 Kalurahan Ringinharjo",
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["KARTABUMI", "SPPT PBB", "Pemetaan Bidang", "PWA Offline", "Bantul", "Ringinharjo"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KARTABUMI",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F2D38",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="font-sans min-h-full flex flex-col bg-[#F0F4F7] text-[#0F2D38]">
        {children}
      </body>
    </html>
  );
}
