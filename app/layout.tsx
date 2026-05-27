import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "英语口语化跟练",
  description: "本地优先的英语口语表达打字练习"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
