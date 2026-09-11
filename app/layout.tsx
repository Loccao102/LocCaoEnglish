import type { Metadata } from "next";
import "./globals.css";
import "./features.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "LocCao English — Learn by Playing",
  description: "Game-first English learning with adaptive skill maps, dictation, speaking and IELTS practice.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
