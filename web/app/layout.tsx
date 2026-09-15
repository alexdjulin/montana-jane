import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Montana Jane",
  description: "A live-directed adventure. Type to steer the scene.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
