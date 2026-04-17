"use client";

import { useEffect } from "react";
import { useAnalytics } from "@/lib/analytics/events";
import { emitEvent } from "@/lib/events";
import { identifyUser } from "@/lib/analytics/identity";
import type { AuthProvider, AuthUser } from "@/lib/auth/types";

const LAST_IDENTIFIED_USER_KEY = "dashboard:last_identified_user";

export function AuthIdentitySync({
  user,
  provider,
}: {
  user: AuthUser;
  provider: AuthProvider;
}) {
  const { capture } = useAnalytics();

  useEffect(() => {
    identifyUser(user.id);

    if (window.sessionStorage.getItem(LAST_IDENTIFIED_USER_KEY) === user.id) {
      return;
    }

    window.sessionStorage.setItem(LAST_IDENTIFIED_USER_KEY, user.id);
    emitEvent("user.signed_in", { provider });
    capture("user.signed_in", { provider });
  }, [capture, provider, user.id]);

  return null;
}
