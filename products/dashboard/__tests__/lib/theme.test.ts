/**
 * Unit tests for lib/theme.ts.
 *
 * Spec anchor: AEL-45 — PR 2 (Theme tokens + dark-first globals).
 *
 * The hook is the canonical client-side surface for reading and writing the
 * dashboard theme. These tests pin the contract so later slices (toggle UI,
 * Settings page, server-rendered themed components) can rely on it.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  DEFAULT_THEME,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  useTheme,
} from "@/lib/theme";

function resetDom() {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
}

describe("useTheme", () => {
  beforeEach(() => {
    resetDom();
  });

  it("defaults to dark when no DOM attribute is present", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe(DEFAULT_THEME);
  });

  it("syncs with the data-theme attribute applied before mount", () => {
    document.documentElement.setAttribute("data-theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("setTheme writes data-theme and persists to localStorage", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme("light"));

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("toggleTheme flips dark <-> light and persists", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("ignores unrecognised stored values and falls back to default", () => {
    document.documentElement.setAttribute("data-theme", "neon");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe(DEFAULT_THEME);
  });

  it("shares state across consumers — one consumer's update reaches every other", () => {
    // Two independent renderHook calls model two components mounting
    // useTheme() side-by-side. With per-instance state they would drift
    // after the first toggle; the shared store keeps them coherent.
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());

    act(() => a.result.current.setTheme("light"));
    expect(a.result.current.theme).toBe("light");
    expect(b.result.current.theme).toBe("light");

    act(() => b.result.current.toggleTheme());
    expect(a.result.current.theme).toBe("dark");
    expect(b.result.current.theme).toBe("dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  beforeEach(() => {
    resetDom();
  });

  it("applies the persisted theme before paint", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    new Function(THEME_INIT_SCRIPT)();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("falls back to the default when no preference is stored", () => {
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME);
  });

  it("falls back to the default for unrecognised stored values", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME);
  });
});
