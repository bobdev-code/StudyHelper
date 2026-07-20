import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nachprüfung Lerntrainer 2026",
  description:
    "Offline-fähiger Lerntrainer für Portfolio Management und German & International Taxation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
