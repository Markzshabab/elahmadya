import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مجلس شباب قرية الأحمدي - استبيان 2024",
  description: "استبيان شباب قرية الأحمدي (2019-2024) الدورة وتقييم الإدارة - مجلس شباب قرية الأحمدي",
  keywords: ["مجلس شباب", "قرية الأحمدي", "استبيان", "شباب"],
  authors: [{ name: "مجلس شباب قرية الأحمدي" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "مجلس شباب قرية الأحمدي - استبيان 2024",
    description: "شارك رأيك في استبيان مجلس شباب قرية الأحمدي",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} font-cairo antialiased bg-gradient-to-b from-green-50 to-white min-h-screen`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors dir="rtl" />
      </body>
    </html>
  );
}
