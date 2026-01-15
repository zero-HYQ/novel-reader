import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "./SwRegister";

export const metadata: Metadata = {
  title: "三七摸鱼阅读器",
  description: "本地 txt 静态小说阅读器（可离线）",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
