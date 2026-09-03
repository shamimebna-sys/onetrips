import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ChromeGate } from "@/components/ChromeGate";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Onetrips - Travel Solution",
  description: "All in One Travel Solution",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased font-sans">
        <ChromeGate>{children}</ChromeGate>
      </body>
    </html>
  );
}
