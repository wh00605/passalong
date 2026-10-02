import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CookieBanner } from "@/components/cookie-banner";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Passalong – buy and sell pre-loved fashion in the UK", template: "%s | Passalong" },
  description:
    "Buy and sell second-hand clothes, shoes, homeware, books and more across the UK. No selling fees, with Buyer Protection on every order.",
  applicationName: "Passalong",
  openGraph: { siteName: "Passalong", locale: "en_GB", type: "website" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#3b31a3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  );
}
