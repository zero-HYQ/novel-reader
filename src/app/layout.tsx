import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小说阅读器",
  description: "本地 txt 静态小说阅读器",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
