// tests/tools/session.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createSessionStore } from "../../src/session/sessions";
import { createSessionTools } from "../../src/tools/session";

describe("Session Tools", () => {
  let sessions: ReturnType<typeof createSessionStore>;
  let tools: ReturnType<typeof createSessionTools>;

  beforeEach(() => {
    sessions = createSessionStore({ skipBrowser: true });
    tools = createSessionTools(sessions);
  });

  afterEach(async () => {
    await sessions.cleanup();
  });

  describe("start_session", () => {
    it("should start a session and return formatted output", async () => {
      const result = await tools.start_session.execute(
        {
          title: "Test",
          questions: [{ type: "confirm", config: { question: "Test?" } }],
        },
        {} as any,
      );

      expect(result).toContain("Session Started");
      expect(result).toContain("Session ID");
      expect(result).toContain("ses_");
    });

    it("should fail without questions", async () => {
      const result = await tools.start_session.execute({ title: "Test" } as any, {} as any);

      expect(result).toContain("ERROR");
      expect(result).toContain("questions parameter is REQUIRED");
    });
  });

  describe("end_session", () => {
    it("should end a session successfully", async () => {
      const startResult = await tools.start_session.execute(
        {
          questions: [{ type: "confirm", config: { question: "Test?" } }],
        },
        {} as any,
      );
      const sessionId = startResult.match(/ses_[a-z0-9]+/)?.[0];

      const result = await tools.end_session.execute({ session_id: sessionId! }, {} as any);

      expect(result).toContain("ended successfully");
    });

    it("should handle non-existent session", async () => {
      const result = await tools.end_session.execute({ session_id: "ses_fake" }, {} as any);

      expect(result).toContain("Failed");
    });
  });
});
