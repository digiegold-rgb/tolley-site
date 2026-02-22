import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "t-agent | Real Estate Unlocked",
  description:
    "T-Agent is a premium search portal for real estate agents to unlock trusted vendors, guidance, and deal-closing momentum.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${jetBrainsMono.variable} antialiased`}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
