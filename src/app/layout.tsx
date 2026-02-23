import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import PWARegister from "@/components/PWARegister";
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
  title: "StrikeZone - Book Cricket Practice Sessions",
  description: "Book professional cricket practice sessions with advanced bowling machines. 4 pro machines, 3 pitch types, flexible 30-min slots.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StrikeZone",
  },
  openGraph: {
    title: "StrikeZone",
    description: "Book professional cricket practice sessions. 4 bowling machines, 3 pitch types, morning & evening slots.",
    type: "website",
    siteName: "StrikeZone",
  },
  twitter: {
    card: "summary",
    title: "StrikeZone",
    description: "Book professional cricket practice sessions with advanced bowling machines.",
  },
  icons: {
    icon: [
      { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152" },
      { url: "/icons/icon-192x192.png", sizes: "192x192" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e3a5f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a1628] min-h-screen`}
      >
        <Providers>
          <ToastProvider>
            <ErrorBoundary>
              <Navbar />
              <main className="safe-bottom">{children}</main>
            </ErrorBoundary>
          </ToastProvider>
          <PWARegister />
        </Providers>
      </body>
    </html>
  );
}
