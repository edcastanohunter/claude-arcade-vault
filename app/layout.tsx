import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const pixelFont = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Play games online and compete for high scores.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pixelFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <div id="root">
          <main className="av-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
