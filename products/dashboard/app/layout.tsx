import type { Metadata } from "next";
import "./globals.css";
import { getAppRelease, getReleaseChannel } from "@/lib/release";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme-tokens";
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
    <html lang="en" data-theme={DEFAULT_THEME}>
      <head>
        {/*
         * Pre-paint theme rehydration. Runs before React hydrates so a
         * persisted preference replaces the default `data-theme="dark"`
         * without a visible flash. The script body lives in
         * `lib/theme-tokens.ts` (server-safe) and the matching client
         * runtime lives in `lib/theme.ts`, so DOM and storage semantics
         * stay in one place.
         */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body
        className="h-screen flex overflow-hidden bg-bg text-t1"
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
