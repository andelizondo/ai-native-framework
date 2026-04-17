import { NextResponse } from "next/server";
import { captureMessage } from "@/lib/monitoring";
import { exchangeCallback } from "@/lib/auth/service.server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const result = await exchangeCallback(request.url);

  if (result.ok) {
    return NextResponse.redirect(`${origin}/`);
  }

  captureMessage("Auth callback redirected to retry state", "warning", {
    feature: "auth.callback",
    extra: { reason: result.error.code },
  });

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
