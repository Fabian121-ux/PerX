import type { Metadata } from "next";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { MockModeIndicator } from "@/components/dev/mock-mode-indicator";

import "./globals.css";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "perX",
  },
  applicationName: "perX",
  description:
    "Discover trusted people, businesses and opportunities through perX.",
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/favicon.ico" },
      { sizes: "16x16", type: "image/png", url: "/icons/favicon-16x16.png" },
      { sizes: "32x32", type: "image/png", url: "/icons/favicon-32x32.png" },
      { sizes: "48x48", type: "image/png", url: "/icons/favicon-48x48.png" },
      { sizes: "192x192", type: "image/png", url: "/icons/icon-192.png" },
      { sizes: "512x512", type: "image/png", url: "/icons/icon-512.png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    description:
      "Discover trusted people, businesses and opportunities through perX.",
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
      className="h-full antialiased"
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
