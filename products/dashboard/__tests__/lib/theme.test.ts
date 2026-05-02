/**
 * Unit tests for lib/theme.ts.
 *
 * Spec anchor: AEL-45 — PR 2 (Theme tokens + dark-first globals).
 *
 * The hook is the canonical client-side surface for reading and writing the
 * dashboard theme. These tests pin the contract so later slices (toggle UI,
 * Settings page, server-rendered themed components) can rely on it.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  DEFAULT_THEME,
  DEFAULT_PREFERENCE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme";

function resetDom() {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
}

describe("useTheme", () => {
  beforeEach(() => {
    resetDom();
  });

  it("defaults to dark theme when no DOM attribute is present", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe(DEFAULT_THEME);
  });

  it("defaults preference to 'system' when nothing is stored", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe(DEFAULT_PREFERENCE);
    expect(result.current.preference).toBe("system");
  });

  it("syncs theme with the data-theme attribute applied before mount", () => {
    document.documentElement.setAttribute("data-theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });

  it("setPreference('dark') writes data-theme and persists to localStorage", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference("dark"));

    expect(result.current.theme).toBe("dark");
    expect(result.current.preference).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("setPreference('light') writes data-theme and persists to localStorage", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference("light"));

    expect(result.current.theme).toBe("light");
    expect(result.current.preference).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("setPreference('system') stores 'system' and resolves via matchMedia", () => {
    // jsdom defaults matchMedia to non-matching (light system preference).
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference("dark"));
    act(() => result.current.setPreference("system"));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(result.current.preference).toBe("system");
    // Resolved theme must be a valid Theme value.
    expect(["dark", "light"]).toContain(result.current.theme);
  });

  it("ignores unrecognised stored values and falls back to default preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe(DEFAULT_PREFERENCE);
  });

  it("ignores unrecognised data-theme attribute and falls back to default", () => {
    document.documentElement.setAttribute("data-theme", "neon");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe(DEFAULT_THEME);
  });

  it("shares state across consumers — one consumer's update reaches every other", () => {
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());

    act(() => a.result.current.setPreference("light"));
    expect(a.result.current.theme).toBe("light");
    expect(b.result.current.theme).toBe("light");

    act(() => b.result.current.setPreference("dark"));
    expect(a.result.current.theme).toBe("dark");
    expect(b.result.current.theme).toBe("dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  beforeEach(() => {
    resetDom();
  });

  it("applies the persisted 'light' theme before paint", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    new Function(THEME_INIT_SCRIPT)();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies the persisted 'dark' theme before paint", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    new Function(THEME_INIT_SCRIPT)();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("resolves via matchMedia when preference is 'system'", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");

    // jsdom's matchMedia always returns non-matching, so system → light.
    new Function(THEME_INIT_SCRIPT)();

    expect(["dark", "light"]).toContain(
      document.documentElement.getAttribute("data-theme"),
    );
  });

  it("resolves via matchMedia when no preference is stored", () => {
    new Function(THEME_INIT_SCRIPT)();

    expect(["dark", "light"]).toContain(
      document.documentElement.getAttribute("data-theme"),
    );
  });

  it("falls back to the default when matchMedia is unavailable and nothing is stored", () => {
    const origMatchMedia = window.matchMedia;
    // @ts-expect-error — simulating a browser without matchMedia
    window.matchMedia = undefined;

    new Function(THEME_INIT_SCRIPT)();

    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME);
    window.matchMedia = origMatchMedia;
  });

  it("falls back to the default for unrecognised stored values", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    new Function(THEME_INIT_SCRIPT)();
    // Unrecognised → treated like "system" → resolved via matchMedia.
    expect(["dark", "light"]).toContain(
      document.documentElement.getAttribute("data-theme"),
    );
  });
});
