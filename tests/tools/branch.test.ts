// tests/tools/branch.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rmSync } from "fs";
import { createBranchTools } from "../../src/tools/branch";
import { StateManager } from "../../src/state/manager";
import { SessionManager } from "../../src/session/manager";

const TEST_DIR = "/tmp/brainstorm-branch-test";

describe("Branch Tools", () => {
  let stateManager: StateManager;
  let sessionManager: SessionManager;
  let tools: ReturnType<typeof createBranchTools>;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    stateManager = new StateManager(TEST_DIR);
    sessionManager = new SessionManager({ skipBrowser: true });
    tools = createBranchTools(stateManager, sessionManager);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("create_brainstorm", () => {
    it("should create brainstorm session with branches", async () => {
      const result = await tools.create_brainstorm.execute({
        request: "Add healthcheck",
        branches: [
          {
            id: "services",
            scope: "Which services to monitor",
            initial_question: {
              type: "ask_text",
              config: { question: "What services?" },
            },
          },
        ],
      }, {} as any);

      expect(result).toContain("ses_");
      expect(result).toContain("services");
    });
  });

  describe("get_branch_status", () => {
    it("should return branch status and context", async () => {
      await stateManager.createSession("ses_status", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);
      await stateManager.addQuestionToBranch("ses_status", "branch1", {
        id: "q1",
        type: "ask_text",
        text: "What is the goal?",
        config: { question: "What is the goal?" },
      });

      const result = await tools.get_branch_status.execute({
        session_id: "ses_status",
        branch_id: "branch1",
      }, {} as any);

      expect(result).toContain("Test scope");
      expect(result).toContain("exploring");
    });
  });

  describe("complete_branch", () => {
    it("should mark branch as done with finding", async () => {
      await stateManager.createSession("ses_comp", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);

      const result = await tools.complete_branch.execute({
        session_id: "ses_comp",
        branch_id: "branch1",
        finding: "User wants PostgreSQL",
      }, {} as any);

      expect(result).toContain("done");
      const state = await stateManager.getSession("ses_comp");
      expect(state!.branches.branch1.status).toBe("done");
    });
  });
});
