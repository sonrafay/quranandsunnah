// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/components/auth/AuthProvider";
import { Navigation } from "@/components/Navigation";
import AmbientGlow from "@/components/AmbientGlow";
import AppOpenTracker from "@/components/AppOpenTracker";

import { ToasterProvider } from "@/components/ui/toaster";
import ClientNotifications from "@/components/notifications/ClientNotifications";
import { Analytics } from "@vercel/analytics/next";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Quran & Sunnah",
  description: "Read the Qur'an and Sunnah beautifully, for free.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
          <AuthProvider>
            <AmbientGlow />
            <AppOpenTracker />
            <ToasterProvider>
              {/* Top nav & page content */}
              <div className="relative z-10">
                <Navigation />
                {/* Client-side notifications runtime (permission + future scheduling hooks) */}
                <ClientNotifications />
                {children}
              </div>
            </ToasterProvider>
            <Analytics />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
