import type { Metadata } from "next";
import { Manrope, Outfit } from "next/font/google";
import "./globals.css";

const heading = Outfit({ variable: "--font-heading", subsets: ["latin"], weight: ["400", "500", "600"] });
const body = Manrope({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PlaceMates",
  description: "Fresh jobs every morning, each with a resume tailored to it from what you've really done.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable} antialiased bg-mist text-ink`}>{children}</body>
    </html>
  );
}
