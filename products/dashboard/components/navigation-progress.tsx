"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Phase = "idle" | "loading" | "done";

const CSS = `
  @keyframes np-grow { 0% { transform:scaleX(0) } 100% { transform:scaleX(0.85) } }
  @keyframes np-done  { 0% { transform:scaleX(0.85);opacity:1 } 70% { transform:scaleX(1);opacity:1 } 100% { transform:scaleX(1);opacity:0 } }
`;

const FAIL_SAFE_MS = 12_000;

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const prev = useRef(pathname);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const failSafeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as Element).closest("a");
      if (!a) return;
      if (a.target === "_blank") return;
      if (a.hasAttribute("download")) return;

      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      clearTimeout(failSafeTimer.current);
      setPhase("loading");
      failSafeTimer.current = setTimeout(() => {
        failSafeTimer.current = undefined;
        setPhase("idle");
      }, FAIL_SAFE_MS);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (pathname === prev.current) return;
    prev.current = pathname;
    clearTimeout(failSafeTimer.current);
    failSafeTimer.current = undefined;
    setPhase("done");
    clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setPhase("idle"), 500);
  }, [pathname]);

  useEffect(
    () => () => {
      clearTimeout(doneTimer.current);
      clearTimeout(failSafeTimer.current);
    },
    [],
  );

  if (phase === "idle") return null;

  return (
    <>
      <style>{CSS}</style>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: "0 0 auto 0",
          height: "2px",
          zIndex: 9999,
          background: "var(--accent)",
          transformOrigin: "left center",
          animation:
            phase === "loading"
              ? "np-grow 3s ease-out forwards"
              : "np-done 0.4s ease-out forwards",
          boxShadow: "0 0 6px var(--accent)",
        }}
      />
    </>
  );
}
