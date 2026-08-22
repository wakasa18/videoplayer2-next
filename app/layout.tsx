import type { Metadata } from "next";
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
    <html lang="en">
      <body className={`${inter.variable} min-h-screen bg-[#f8f9fa] antialiased`}>
        {children}
      </body>
    </html>
  );
}
