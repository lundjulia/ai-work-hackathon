import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import ServiceWorkerRegistration from "@/components/service-worker-registration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Autopilot",
  description: "Money on autopilot: your banks, checked daily by an agent.",
  applicationName: "Autopilot",
  appleWebApp: { capable: true, title: "Autopilot", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#fafbfc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[oklch(0.94_0.006_250)] antialiased dark:bg-black`}>
        <Providers>
          {/* Phone-width column, centered on desktop. */}
          <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_20px_60px_-20px_rgb(0_0_0/0.15)]">
            {children}
          </div>
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
