import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Inter } from "next/font/google";
import { SecretProvider } from "@/components/Secret";
import { themeScript } from "@/components/Theme";
import { ToastProvider } from "@/components/Toast";
import { TopProgress } from "@/components/TopProgress";
import { Suspense } from "react";
import "./globals.css";

const plex = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = { title: "Reels Insight", description: "วิเคราะห์การเติบโตของโพสต์ Facebook" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plex.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <TopProgress />
        </Suspense>
        <SecretProvider>
          <ToastProvider>{children}</ToastProvider>
        </SecretProvider>
      </body>
    </html>
  );
}
