import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BARAPRO v11 — Evaluación Financiera Profesional",
  description:
    "Herramienta integral de evaluación financiera para estudios de factibilidad conforme a la Resolución 1/2022. Calcula VAN, TIR, RVAN, TIRM, PRD, B/C, análisis de sensibilidad y escenarios para proyectos de desarrollo local.",
  keywords: [
    "BARAPRO",
    "evaluación financiera",
    "factibilidad económica",
    "desarrollo local",
    "Cuba",
    "Resolución 1/2022",
    "VAN",
    "TIR",
    "RVAN",
    "TIRM",
    "análisis de sensibilidad",
    "proyecto",
    "PDL",
  ],
  icons: {
    icon: "/logo-barapro.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
