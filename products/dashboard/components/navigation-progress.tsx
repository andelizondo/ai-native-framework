"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Phase = "idle" | "loading" | "done";

const CSS = `
  @keyframes np-grow { 0% { transform:scaleX(0) } 100% { transform:scaleX(0.85) } }
  @keyframes np-done  { 0% { transform:scaleX(0.85);opacity:1 } 70% { transform:scaleX(1);opacity:1 } 100% { transform:scaleX(1);opacity:0 } }
`;

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const prev = useRef(pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as Element).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        /^https?:\/\//.test(href)
      )
        return;
      const target = href.split("?")[0].split("#")[0];
      if (target === window.location.pathname) return;
      setPhase("loading");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (pathname === prev.current) return;
    prev.current = pathname;
    setPhase("done");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase("idle"), 500);
  }, [pathname]);

  useEffect(() => () => clearTimeout(timer.current), []);

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
