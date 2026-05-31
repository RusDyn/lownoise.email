import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "lownoise.email — high-signal engineering jobs",
  description:
    "One email a day, personalized for you. From ~6,000 fresh engineering roles scanned daily, we score every posting against your stack — top 10 matches straight to your inbox.",
  openGraph: {
    title: "lownoise.email — high-signal engineering jobs",
    description:
      "One email a day, personalized for you. From ~6,000 fresh engineering roles scanned daily, we score every posting against your stack — top 10 matches straight to your inbox.",
    url: "https://lownoise.email",
    siteName: "lownoise.email",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "lownoise.email — high-signal engineering jobs",
    description:
      "One email a day. Up to 10 hand-scored engineering roles matched to your stack, straight to your inbox.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={mono.variable}>
      <body>{children}</body>
    </html>
  );
}
