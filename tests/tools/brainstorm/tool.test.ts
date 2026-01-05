// tests/tools/brainstorm/tool.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "../../../src/session/manager";
import { createBrainstormTool } from "../../../src/tools/brainstorm";

describe("Brainstorm Tool", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await sessionManager.cleanup();
  });

  describe("createBrainstormTool", () => {
    it("should create a tool with correct description", () => {
      const mockClient = {} as any;
      const tool = createBrainstormTool(sessionManager, mockClient);

      expect(tool.description).toContain("brainstorming session");
    });

    it("should have required args", () => {
      const mockClient = {} as any;
      const tool = createBrainstormTool(sessionManager, mockClient);

      expect(tool.args).toHaveProperty("context");
      expect(tool.args).toHaveProperty("request");
      expect(tool.args).toHaveProperty("initial_questions");
    });
  });

  describe("execute", () => {
    it("should fail without initial questions", async () => {
      const mockClient = {} as any;
      const tool = createBrainstormTool(sessionManager, mockClient);

      const result = await tool.execute(
        {
          context: "Test",
          request: "Test",
          initial_questions: [],
        },
        { sessionID: "test", messageID: "test", agent: "test", abort: new AbortController().signal },
      );

      expect(result).toContain("ERROR");
      expect(result).toContain("at least one initial question");
    });
  });
});
