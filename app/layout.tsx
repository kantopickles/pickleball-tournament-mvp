import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pickle Draw",
  description: "Pickleball tournament management MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
