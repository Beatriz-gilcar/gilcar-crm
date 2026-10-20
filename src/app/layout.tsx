import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { CorridaMeta } from "@/components/CorridaMeta";
import { LembretesWidget } from "@/components/LembretesWidget";
import { RotinaAlertWidget } from "@/components/RotinaAlertWidget";
import { AbastecimentoAlertWidget } from "@/components/AbastecimentoAlertWidget";
import { MuralAlertWidget } from "@/components/MuralAlertWidget";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  style: ["italic"],
  weight: ["600", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gilcar CRM",
  description: "CRM de leads e atendimentos",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gilcar",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1420",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <CorridaMeta />
        <LembretesWidget />
        <RotinaAlertWidget />
        <AbastecimentoAlertWidget />
        <MuralAlertWidget />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
