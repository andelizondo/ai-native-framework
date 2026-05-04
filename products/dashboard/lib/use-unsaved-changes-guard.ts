"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Intercepts in-app navigation while an editor has unsaved changes.
 *
 * - Hard navigation (tab close, refresh, external URL): browser-native
 *   `beforeunload` confirm.
 * - In-app anchor clicks (sidebar links, workflow tree, breadcrumbs):
 *   captured at the document level. If `enabled`, the click is cancelled
 *   and `onBlock` is invoked with a `proceed` callback that performs the
 *   intended navigation via Next.js's router (so the SPA stays warm).
 *
 * The caller renders its own confirmation UI and calls `proceed()` on
 * approval, or simply drops the callback to cancel.
 *
 * Modifier-clicks (cmd/ctrl/shift/alt) and middle-clicks are passed
 * through so users can open links in a new tab without being prompted.
 */
export function useUnsavedChangesGuard({
  enabled,
  onBlock,
}: {
  enabled: boolean;
  onBlock: (proceed: () => void) => void;
}): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("http://") || href.startsWith("https://")) return;
      if (href.startsWith("#")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const currentHref = `${window.location.pathname}${window.location.search}`;
      if (href === currentHref) return;

      event.preventDefault();
      event.stopPropagation();
      onBlock(() => router.push(href));
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [enabled, onBlock, router]);
}
