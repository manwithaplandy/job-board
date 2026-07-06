import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f4f6fa" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={hanken.className}>
        {/* Global so background-generation completion toasts survive navigating
            away from the board (the poller + <Toaster/> live above every page).
            ThemeProvider wraps it so the toast pill's var(--token) colors resolve
            in the themed tree. */}
        <ThemeProvider>
          <GenerationToastProvider>{children}</GenerationToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
