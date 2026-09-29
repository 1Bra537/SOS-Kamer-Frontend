import type { Metadata } from "next";
import {NextIntlClientProvider} from "next-intl";
import {getLocale} from "next-intl/server";
import AmplifyClient from "./AmplifyClient";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "SOS-Kamer | Emergency Incident Reporting",
  description: "Report incidents quickly and securely with SOS-Kamer.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <AmplifyClient />

          <div className="fixed bottom-4 right-4 z-[100]">
            <LanguageSwitcher />
          </div>

          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
