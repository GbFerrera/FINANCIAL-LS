import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Share_Tech } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const shareTech = Share_Tech({
  variable: "--font-share-tech",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Link System - Administrativo",
  description: "Gerenciador administrativo LS - projetos, finanças e equipe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${shareTech.variable} antialiased`}
      >
        
         <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          <Providers>
            <AppShell>
              {children}
            </AppShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
