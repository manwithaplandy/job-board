import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remote Job Tracker",
  description: "Open roles across tracked companies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
