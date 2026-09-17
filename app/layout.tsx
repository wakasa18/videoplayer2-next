import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./theme.css";

import { UIPerformanceController } from "@/components/ui/ui-performance-controller";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";

const defaultUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Damon's Archive",
    template: "%s · Damon's Archive",
  },
  description: "A private workspace for files, assignments, and videos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Damon's Archive", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#10191d",
  viewportFit: "cover",
};

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body className={`${inter.variable} high-tech-theme min-h-screen antialiased`}>
        <UIPerformanceController />
        <a href="#main-content" className="skip-link" data-no-glass>Skip to main content</a>
        {children}
        <ConfirmDialogHost />
      </body>
    </html>
  );
}
