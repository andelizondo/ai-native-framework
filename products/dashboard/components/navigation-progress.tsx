"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const FAIL_SAFE_MS = 12_000;

export function NavigationProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const prev = useRef(pathname);
  const failSafe = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fadeOut = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Stable imperative API — only touches the DOM via ref, never re-renders.
  const api = useRef({
    start() {
      const bar = barRef.current;
      if (!bar) return;
      clearTimeout(fadeOut.current);
      // Jump to 10% with no transition — gives instant visible mass in the
      // same frame as the click, before any React renders can paint.
      bar.style.transition = "none";
      bar.style.opacity = "1";
      bar.style.width = "10%";
      void bar.getBoundingClientRect(); // flush the reset so the grow starts from here
      // Linear feels like "steady progress" — ease-out rushes then crawls.
      bar.style.transition = "width 2.5s linear";
      bar.style.width = "85%";
    },
    done() {
      const bar = barRef.current;
      if (!bar) return;
      clearTimeout(fadeOut.current);
      bar.style.transition = "width 200ms ease-out";
      bar.style.width = "100%";
      fadeOut.current = setTimeout(() => {
        if (!barRef.current) return;
        barRef.current.style.transition = "opacity 300ms";
        barRef.current.style.opacity = "0";
        fadeOut.current = setTimeout(() => {
          if (!barRef.current) return;
          barRef.current.style.transition = "none";
          barRef.current.style.width = "0%";
        }, 300);
      }, 200);
    },
  });

  // Navigation start: click on any internal anchor.
  // capture:true fires before React's synthetic event system and before
  // Next.js's router intercept, so the bar gets its first paint in the
  // frame before the Suspense skeleton renders.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      api.current.start();
      clearTimeout(failSafe.current);
      failSafe.current = setTimeout(() => api.current.done(), FAIL_SAFE_MS);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Navigation end: pathname changed.
  useEffect(() => {
    if (pathname === prev.current) return;
    prev.current = pathname;
    clearTimeout(failSafe.current);
    api.current.done();
  }, [pathname]);

  // Cleanup timers on unmount.
  useEffect(
    () => () => {
      clearTimeout(failSafe.current);
      clearTimeout(fadeOut.current);
    },
    [],
  );

  return (
    <div
      ref={barRef}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "2px",
        width: "0%",
        opacity: 0,
        zIndex: 9999,
        background: "var(--accent)",
        boxShadow: "0 0 6px var(--accent)",
        pointerEvents: "none",
      }}
    />
  );
}
