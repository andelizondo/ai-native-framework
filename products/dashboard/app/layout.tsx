import type { Metadata } from "next";
import "./globals.css";
import { getAppRelease, getReleaseChannel } from "@/lib/release";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "AI-Native Dashboard",
  description: "AI-native operating framework dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appRelease = getAppRelease();

  return (
    <html lang="en">
      <body
        className="h-screen flex overflow-hidden"
        data-release={appRelease}
        data-release-channel={getReleaseChannel()}
      >
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
