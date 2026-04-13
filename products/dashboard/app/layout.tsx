import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
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
        {/* Left sidebar — fixed width, full height */}
        <Sidebar />

        {/* Right column — top bar + scrollable content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-6">
            {children}
          </main>
        </div>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
