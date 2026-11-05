import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { DadosProvider } from "@/lib/store";
import { Shell } from "@/components/shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finanças G&J",
  description: "Controle financeiro do casal e organização do casamento",
  applicationName: "Finanças G&J",
  appleWebApp: { capable: true, title: "G&J", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <DadosProvider>
          <Shell>{children}</Shell>
        </DadosProvider>
      </body>
    </html>
  );
}
