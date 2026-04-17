import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockIdentifyUser, mockCapture, mockEmitEvent } = vi.hoisted(() => ({
  mockIdentifyUser: vi.fn(),
  mockCapture: vi.fn(),
  mockEmitEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/identity", () => ({
  identifyUser: mockIdentifyUser,
}));

vi.mock("@/lib/analytics/events", () => ({
  useAnalytics: vi.fn(() => ({ capture: mockCapture })),
}));

vi.mock("@/lib/events", () => ({
  emitEvent: mockEmitEvent,
}));

import { AuthIdentitySync } from "@/components/auth-identity-sync";

describe("AuthIdentitySync", () => {
  beforeEach(() => {
    mockIdentifyUser.mockReset();
    mockCapture.mockReset();
    mockEmitEvent.mockReset();
    window.sessionStorage.clear();
  });

  it("identifies the user and emits signed_in once per session", () => {
    render(
      <AuthIdentitySync
        user={{ id: "user-123", email: "founder@example.com" }}
        provider="magic_link"
      />,
    );

    expect(mockIdentifyUser).toHaveBeenCalledWith("user-123");
    expect(mockEmitEvent).toHaveBeenCalledWith("user.signed_in", {
      provider: "magic_link",
    });
    expect(mockCapture).toHaveBeenCalledWith("user.signed_in", {
      provider: "magic_link",
    });
  });

  it("does not emit signed_in again for the same user in the same session", () => {
    window.sessionStorage.setItem("dashboard:last_identified_user", "user-123");

    render(
      <AuthIdentitySync
        user={{ id: "user-123", email: "founder@example.com" }}
        provider="magic_link"
      />,
    );

    expect(mockIdentifyUser).toHaveBeenCalledWith("user-123");
    expect(mockEmitEvent).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
