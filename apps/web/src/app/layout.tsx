import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "@/components/auth-gate";
import { BottomNav } from "@/components/nav/bottom-nav";
import { SwRegister } from "@/components/sw-register";

const sans = Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Penny — Family Budget",
  description: "Calm control over your family budget, with Penny, your AI coach.",
  applicationName: "Penny",
  appleWebApp: { capable: true, title: "Penny", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1F4A39",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#E6E6E0]">
        <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
          <AuthGate>{children}</AuthGate>
        </div>
        <BottomNav />
        <Toaster theme="light" position="top-center" />
        <SwRegister />
      </body>
    </html>
  );
}
