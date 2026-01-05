// tests/agents/bootstrapper.test.ts
import { describe, it, expect } from "bun:test";
import { bootstrapperAgent } from "../../src/agents/bootstrapper";

describe("bootstrapperAgent", () => {
  it("should have correct configuration", () => {
    expect(bootstrapperAgent.mode).toBe("subagent");
    expect(bootstrapperAgent.model).toBe("anthropic/claude-opus-4-5");
  });

  it("should have prompt that requests branches with scopes", () => {
    expect(bootstrapperAgent.prompt).toContain("branches");
    expect(bootstrapperAgent.prompt).toContain("scope");
    expect(bootstrapperAgent.prompt).toContain("initial_question");
  });

  it("should request JSON output format", () => {
    expect(bootstrapperAgent.prompt).toContain("JSON");
  });
});
