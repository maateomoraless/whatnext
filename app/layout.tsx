import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "WhatNext?",
  description: "Tu lista de películas hecha a tu medida"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="WhatNext?" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.className}>
        <Script id="whatnext-sw-register" strategy="afterInteractive">
          {`
            if (typeof window !== "undefined" && "serviceWorker" in navigator) {
              window.addEventListener("load", function () {
                navigator.serviceWorker.register("/sw.js").catch(function () {});
              });
            }
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
