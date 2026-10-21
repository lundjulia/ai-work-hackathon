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
  appleWebApp: { capable: true, title: "Autopilot", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
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
      <body className={`${geistSans.variable} ${geistMono.variable} bg-muted antialiased`}>
        <Providers>
          {/* Phone-width column, centered on desktop. */}
          <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-background pt-[env(safe-area-inset-top)] shadow-sm">
            {children}
          </div>
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
