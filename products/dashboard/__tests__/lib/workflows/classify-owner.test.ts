import { describe, expect, it } from "vitest";

import { classifyOwner } from "@/lib/workflows/classify-owner";

describe("classifyOwner", () => {
  it("classifies labels with the agent: prefix as agent (case-insensitive)", () => {
    expect(classifyOwner("agent:foo")).toBe("agent");
    expect(classifyOwner("AGENT:Sales Ops")).toBe("agent");
    expect(classifyOwner("Agent: bar")).toBe("agent");
  });

  it("classifies plain names as person", () => {
    expect(classifyOwner("Andres")).toBe("person");
    expect(classifyOwner("Hans / Dave")).toBe("person");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(classifyOwner("   agent:foo  ")).toBe("agent");
  });

  it("treats empty strings defensively as person", () => {
    expect(classifyOwner("")).toBe("person");
    expect(classifyOwner("   ")).toBe("person");
  });

  it("treats non-string input defensively as person", () => {
    expect(classifyOwner(undefined as unknown as string)).toBe("person");
    expect(classifyOwner(null as unknown as string)).toBe("person");
  });
});
