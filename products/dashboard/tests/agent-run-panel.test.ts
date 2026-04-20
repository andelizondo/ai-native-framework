import { describe, it, expect } from "vitest";
import { stepStatusIcon } from "@/components/workflows/agent-run-panel";

describe("stepStatusIcon", () => {
  it("returns check symbol for done", () => {
    const result = stepStatusIcon("done");
    expect(result.symbol).toBe("✓");
    expect(result.className).toBe("arp-step-icon--done");
  });

  it("returns filled circle for active", () => {
    const result = stepStatusIcon("active");
    expect(result.symbol).toBe("●");
    expect(result.className).toBe("arp-step-icon--active");
  });

  it("returns hourglass for waiting", () => {
    const result = stepStatusIcon("waiting");
    expect(result.symbol).toBe("⏳");
    expect(result.className).toBe("arp-step-icon--waiting");
  });

  it("returns red cross for failed", () => {
    const result = stepStatusIcon("failed");
    expect(result.symbol).toBe("✗");
    expect(result.className).toBe("arp-step-icon--failed");
  });

  it("returns empty circle for pending", () => {
    const result = stepStatusIcon("pending");
    expect(result.symbol).toBe("○");
    expect(result.className).toBe("arp-step-icon--pending");
  });
});
