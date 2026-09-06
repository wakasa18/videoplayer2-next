import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
  themeColor: "#07101d",
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
    <html lang="en" className="dark">
      <body className={`${inter.variable} high-tech-theme min-h-screen antialiased`}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
