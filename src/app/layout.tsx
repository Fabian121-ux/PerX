import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { MockModeIndicator } from "@/components/dev/mock-mode-indicator";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "perX",
  },
  applicationName: "perX",
  description:
    "perX is an opportunity ecosystem for discovering opportunities, building trust, creating structured deals, and tracking beta-stage simulated payment states.",
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/favicon.ico" },
      { sizes: "16x16", type: "image/png", url: "/icons/favicon-16x16.png" },
      { sizes: "32x32", type: "image/png", url: "/icons/favicon-32x32.png" },
      { sizes: "192x192", type: "image/png", url: "/icons/icon-192.png" },
      { sizes: "512x512", type: "image/png", url: "/icons/icon-512.png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    description:
      "Discover opportunities, connect with people, create proposals, manage deals, and build reputation on perX.",
    siteName: "perX",
    title: "perX",
    type: "website",
  },
  title: {
    default: "perX",
    template: "%s | perX",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ServiceWorkerRegister />
          {children}
          <MockModeIndicator />
        </ThemeProvider>
      </body>
    </html>
  );
}
