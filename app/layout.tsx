import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanto Pickle's Drow",
  description: "ピックルボール大会を、運営しやすく、参加者にもやさしく回せる大会管理アプリ"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
