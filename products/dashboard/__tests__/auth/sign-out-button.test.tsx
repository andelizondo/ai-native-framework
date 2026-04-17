import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockReplace,
  mockRefresh,
  mockSignOut,
  mockCapture,
  mockEmitEvent,
  mockResetIdentity,
  mockCaptureMessage,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
  mockSignOut: vi.fn(),
  mockCapture: vi.fn(),
  mockEmitEvent: vi.fn(),
  mockResetIdentity: vi.fn(),
  mockCaptureMessage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    replace: mockReplace,
    refresh: mockRefresh,
  })),
}));

vi.mock("@/lib/auth/service", () => ({
  signOut: mockSignOut,
}));

vi.mock("@/lib/analytics/events", () => ({
  useAnalytics: vi.fn(() => ({ capture: mockCapture })),
}));

vi.mock("@/lib/events", () => ({
  emitEvent: mockEmitEvent,
}));

vi.mock("@/lib/analytics/identity", () => ({
  resetIdentity: mockResetIdentity,
}));

vi.mock("@/lib/monitoring", () => ({
  captureMessage: mockCaptureMessage,
}));

import { SignOutButton } from "@/components/sign-out-button";

describe("SignOutButton", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockSignOut.mockReset();
    mockCapture.mockReset();
    mockEmitEvent.mockReset();
    mockResetIdentity.mockReset();
    mockCaptureMessage.mockReset();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("dashboard:last_identified_user", "user-123");
  });

  it("signs out, clears identity, and redirects to /login", async () => {
    mockSignOut.mockResolvedValue({
      ok: true,
      data: { provider: "magic_link" },
    });

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledOnce());
    expect(mockEmitEvent).toHaveBeenCalledWith("user.signed_out", {
      provider: "magic_link",
    });
    expect(mockCapture).toHaveBeenCalledWith("user.signed_out", {
      provider: "magic_link",
    });
    expect(mockResetIdentity).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem("dashboard:last_identified_user")).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("shows an inline error when sign-out fails", async () => {
    mockSignOut.mockResolvedValue({
      ok: false,
      error: { code: "sign_out_failed", message: "Try again later" },
    });

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(screen.getByText(/try again later/i)).toBeInTheDocument(),
    );
    expect(mockResetIdentity).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledOnce();
  });
});
