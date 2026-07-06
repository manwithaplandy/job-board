import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { GenerationToastProvider } from "@/components/generation/GenerationToastProvider";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Rolefit",
  description: "Open roles across tracked companies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={hanken.className}>
        {/* Global so background-generation completion toasts survive navigating
            away from the board (the poller + <Toaster/> live above every page). */}
        <GenerationToastProvider>{children}</GenerationToastProvider>
      </body>
    </html>
  );
}
