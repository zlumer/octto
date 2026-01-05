# Tree-Based Brainstormer Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fragile hook-based brainstorming architecture with a tree-based, agent-driven system that persists state to files and organizes exploration into scoped branches.

**Architecture:** Each brainstorming session creates a state file (`.brainstorm/{session_id}.json`) containing a tree of branches. Each branch has a specific scope (aspect to explore), contains only questions relevant to that scope, and produces a finding when complete. The agent explicitly controls flow - no hooks.

**Tech Stack:** TypeScript, Bun, OpenCode plugin SDK

---

## Task 1: Add Branch Types

**Files:**
- Modify: `src/session/types.ts`
- Create: `src/state/types.ts`

**Step 1: Create the state types file**

Create `src/state/types.ts`:

```typescript
// src/state/types.ts
import type { QuestionType, QuestionConfig } from "../session/types";

export type BranchStatus = "exploring" | "done";

export interface BranchQuestion {
  id: string;
  type: QuestionType;
  text: string;
  config: QuestionConfig;
  answer?: unknown;
  answeredAt?: number;
}

export interface Branch {
  id: string;
  scope: string;
  status: BranchStatus;
  questions: BranchQuestion[];
  finding: string | null;
}

export interface BrainstormState {
  session_id: string;
  browser_session_id: string | null;
  request: string;
  created_at: number;
  updated_at: number;
  branches: Record<string, Branch>;
  branch_order: string[];
}

export interface CreateBranchInput {
  id: string;
  scope: string;
}

export interface BranchProbeResult {
  done: boolean;
  reason: string;
  finding?: string;
  question?: {
    type: QuestionType;
    config: QuestionConfig;
  };
}
```

**Step 2: Run TypeScript check to verify types**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun run typecheck 2>&1 || echo "Note: typecheck script may not exist yet"`

Expected: Types compile without errors

**Step 3: Commit**

```bash
git add src/state/types.ts
git commit -m "feat(types): add branch and state types for tree-based architecture"
```

---

## Task 2: Create State File Persistence Module

**Files:**
- Create: `src/state/persistence.ts`
- Create: `tests/state/persistence.test.ts`

**Step 1: Write the failing test**

Create `tests/state/persistence.test.ts`:

```typescript
// tests/state/persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { StatePersistence } from "../src/state/persistence";
import type { BrainstormState } from "../src/state/types";

const TEST_DIR = "/tmp/brainstorm-test";

describe("StatePersistence", () => {
  let persistence: StatePersistence;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    persistence = new StatePersistence(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("save and load", () => {
    it("should save state to file and load it back", async () => {
      const state: BrainstormState = {
        session_id: "ses_test123",
        browser_session_id: "ses_browser1",
        request: "Add healthcheck endpoints",
        created_at: Date.now(),
        updated_at: Date.now(),
        branches: {
          infrastructure: {
            id: "infrastructure",
            scope: "Which services need healthchecks",
            status: "exploring",
            questions: [],
            finding: null,
          },
        },
        branch_order: ["infrastructure"],
      };

      await persistence.save(state);

      const loaded = await persistence.load("ses_test123");

      expect(loaded).not.toBeNull();
      expect(loaded!.session_id).toBe("ses_test123");
      expect(loaded!.request).toBe("Add healthcheck endpoints");
      expect(loaded!.branches.infrastructure.scope).toBe("Which services need healthchecks");
    });

    it("should return null for non-existent session", async () => {
      const loaded = await persistence.load("ses_nonexistent");
      expect(loaded).toBeNull();
    });

    it("should create directory if it does not exist", async () => {
      const state: BrainstormState = {
        session_id: "ses_new",
        browser_session_id: null,
        request: "Test",
        created_at: Date.now(),
        updated_at: Date.now(),
        branches: {},
        branch_order: [],
      };

      await persistence.save(state);

      expect(existsSync(TEST_DIR)).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete state file", async () => {
      const state: BrainstormState = {
        session_id: "ses_delete",
        browser_session_id: null,
        request: "Delete me",
        created_at: Date.now(),
        updated_at: Date.now(),
        branches: {},
        branch_order: [],
      };

      await persistence.save(state);
      expect(await persistence.load("ses_delete")).not.toBeNull();

      await persistence.delete("ses_delete");
      expect(await persistence.load("ses_delete")).toBeNull();
    });
  });

  describe("list", () => {
    it("should list all session IDs", async () => {
      const state1: BrainstormState = {
        session_id: "ses_list1",
        browser_session_id: null,
        request: "First",
        created_at: Date.now(),
        updated_at: Date.now(),
        branches: {},
        branch_order: [],
      };
      const state2: BrainstormState = {
        session_id: "ses_list2",
        browser_session_id: null,
        request: "Second",
        created_at: Date.now(),
        updated_at: Date.now(),
        branches: {},
        branch_order: [],
      };

      await persistence.save(state1);
      await persistence.save(state2);

      const ids = await persistence.list();
      expect(ids).toContain("ses_list1");
      expect(ids).toContain("ses_list2");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/state/persistence.test.ts`

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/state/persistence.ts`:

```typescript
// src/state/persistence.ts
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import type { BrainstormState } from "./types";

export class StatePersistence {
  private baseDir: string;

  constructor(baseDir: string = ".brainstorm") {
    this.baseDir = baseDir;
  }

  private getFilePath(sessionId: string): string {
    return join(this.baseDir, `${sessionId}.json`);
  }

  private ensureDir(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async save(state: BrainstormState): Promise<void> {
    this.ensureDir();
    const filePath = this.getFilePath(state.session_id);
    state.updated_at = Date.now();
    await Bun.write(filePath, JSON.stringify(state, null, 2));
  }

  async load(sessionId: string): Promise<BrainstormState | null> {
    const filePath = this.getFilePath(sessionId);
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await Bun.file(filePath).text();
    return JSON.parse(content) as BrainstormState;
  }

  async delete(sessionId: string): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.baseDir)) {
      return [];
    }
    const files = readdirSync(this.baseDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/state/persistence.test.ts`

Expected: PASS

**Step 5: Create index export**

Create `src/state/index.ts`:

```typescript
// src/state/index.ts
export * from "./types";
export * from "./persistence";
```

**Step 6: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): add state file persistence for brainstorm sessions"
```

---

## Task 3: Create State Manager

**Files:**
- Create: `src/state/manager.ts`
- Create: `tests/state/manager.test.ts`

**Step 1: Write the failing test**

Create `tests/state/manager.test.ts`:

```typescript
// tests/state/manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rmSync } from "fs";
import { StateManager } from "../src/state/manager";

const TEST_DIR = "/tmp/brainstorm-manager-test";

describe("StateManager", () => {
  let manager: StateManager;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    manager = new StateManager(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("createSession", () => {
    it("should create a new session with branches", async () => {
      const state = await manager.createSession("ses_create1", "Add healthcheck", [
        { id: "services", scope: "Which services need healthchecks" },
        { id: "format", scope: "What format for healthcheck responses" },
      ]);

      expect(state.session_id).toBe("ses_create1");
      expect(state.request).toBe("Add healthcheck");
      expect(Object.keys(state.branches)).toHaveLength(2);
      expect(state.branches.services.scope).toBe("Which services need healthchecks");
      expect(state.branches.format.scope).toBe("What format for healthcheck responses");
      expect(state.branch_order).toEqual(["services", "format"]);
    });
  });

  describe("addQuestionToBranch", () => {
    it("should add question to the correct branch", async () => {
      await manager.createSession("ses_addq", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);

      const question = await manager.addQuestionToBranch("ses_addq", "branch1", {
        id: "q_test1",
        type: "ask_text",
        text: "What is the goal?",
        config: { question: "What is the goal?" },
      });

      const state = await manager.getSession("ses_addq");
      expect(state!.branches.branch1.questions).toHaveLength(1);
      expect(state!.branches.branch1.questions[0].text).toBe("What is the goal?");
    });
  });

  describe("recordAnswer", () => {
    it("should record answer for a question", async () => {
      await manager.createSession("ses_answer", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);
      await manager.addQuestionToBranch("ses_answer", "branch1", {
        id: "q_ans1",
        type: "ask_text",
        text: "What is the goal?",
        config: { question: "What is the goal?" },
      });

      await manager.recordAnswer("ses_answer", "q_ans1", { text: "Build an API" });

      const state = await manager.getSession("ses_answer");
      expect(state!.branches.branch1.questions[0].answer).toEqual({ text: "Build an API" });
      expect(state!.branches.branch1.questions[0].answeredAt).toBeDefined();
    });
  });

  describe("completeBranch", () => {
    it("should mark branch as done with finding", async () => {
      await manager.createSession("ses_complete", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);

      await manager.completeBranch("ses_complete", "branch1", "User wants PostgreSQL and Redis");

      const state = await manager.getSession("ses_complete");
      expect(state!.branches.branch1.status).toBe("done");
      expect(state!.branches.branch1.finding).toBe("User wants PostgreSQL and Redis");
    });
  });

  describe("getNextExploringBranch", () => {
    it("should return first exploring branch", async () => {
      await manager.createSession("ses_next", "Test", [
        { id: "branch1", scope: "First scope" },
        { id: "branch2", scope: "Second scope" },
      ]);

      const branch = await manager.getNextExploringBranch("ses_next");
      expect(branch!.id).toBe("branch1");
    });

    it("should skip done branches", async () => {
      await manager.createSession("ses_skip", "Test", [
        { id: "branch1", scope: "First scope" },
        { id: "branch2", scope: "Second scope" },
      ]);
      await manager.completeBranch("ses_skip", "branch1", "Done");

      const branch = await manager.getNextExploringBranch("ses_skip");
      expect(branch!.id).toBe("branch2");
    });

    it("should return null when all branches done", async () => {
      await manager.createSession("ses_alldone", "Test", [
        { id: "branch1", scope: "First scope" },
      ]);
      await manager.completeBranch("ses_alldone", "branch1", "Done");

      const branch = await manager.getNextExploringBranch("ses_alldone");
      expect(branch).toBeNull();
    });
  });

  describe("isSessionComplete", () => {
    it("should return false when branches are exploring", async () => {
      await manager.createSession("ses_incomplete", "Test", [
        { id: "branch1", scope: "First scope" },
      ]);

      expect(await manager.isSessionComplete("ses_incomplete")).toBe(false);
    });

    it("should return true when all branches done", async () => {
      await manager.createSession("ses_allcomplete", "Test", [
        { id: "branch1", scope: "First scope" },
      ]);
      await manager.completeBranch("ses_allcomplete", "branch1", "Done");

      expect(await manager.isSessionComplete("ses_allcomplete")).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/state/manager.test.ts`

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/state/manager.ts`:

```typescript
// src/state/manager.ts
import { StatePersistence } from "./persistence";
import type { BrainstormState, Branch, BranchQuestion, CreateBranchInput } from "./types";

export class StateManager {
  private persistence: StatePersistence;

  constructor(baseDir: string = ".brainstorm") {
    this.persistence = new StatePersistence(baseDir);
  }

  async createSession(
    sessionId: string,
    request: string,
    branches: CreateBranchInput[],
  ): Promise<BrainstormState> {
    const branchMap: Record<string, Branch> = {};
    const branchOrder: string[] = [];

    for (const b of branches) {
      branchMap[b.id] = {
        id: b.id,
        scope: b.scope,
        status: "exploring",
        questions: [],
        finding: null,
      };
      branchOrder.push(b.id);
    }

    const state: BrainstormState = {
      session_id: sessionId,
      browser_session_id: null,
      request,
      created_at: Date.now(),
      updated_at: Date.now(),
      branches: branchMap,
      branch_order: branchOrder,
    };

    await this.persistence.save(state);
    return state;
  }

  async getSession(sessionId: string): Promise<BrainstormState | null> {
    return this.persistence.load(sessionId);
  }

  async setBrowserSessionId(sessionId: string, browserSessionId: string): Promise<void> {
    const state = await this.persistence.load(sessionId);
    if (!state) throw new Error(`Session not found: ${sessionId}`);
    state.browser_session_id = browserSessionId;
    await this.persistence.save(state);
  }

  async addQuestionToBranch(
    sessionId: string,
    branchId: string,
    question: BranchQuestion,
  ): Promise<BranchQuestion> {
    const state = await this.persistence.load(sessionId);
    if (!state) throw new Error(`Session not found: ${sessionId}`);
    if (!state.branches[branchId]) throw new Error(`Branch not found: ${branchId}`);

    state.branches[branchId].questions.push(question);
    await this.persistence.save(state);
    return question;
  }

  async recordAnswer(sessionId: string, questionId: string, answer: unknown): Promise<void> {
    const state = await this.persistence.load(sessionId);
    if (!state) throw new Error(`Session not found: ${sessionId}`);

    for (const branch of Object.values(state.branches)) {
      const question = branch.questions.find((q) => q.id === questionId);
      if (question) {
        question.answer = answer;
        question.answeredAt = Date.now();
        await this.persistence.save(state);
        return;
      }
    }
    throw new Error(`Question not found: ${questionId}`);
  }

  async completeBranch(sessionId: string, branchId: string, finding: string): Promise<void> {
    const state = await this.persistence.load(sessionId);
    if (!state) throw new Error(`Session not found: ${sessionId}`);
    if (!state.branches[branchId]) throw new Error(`Branch not found: ${branchId}`);

    state.branches[branchId].status = "done";
    state.branches[branchId].finding = finding;
    await this.persistence.save(state);
  }

  async getNextExploringBranch(sessionId: string): Promise<Branch | null> {
    const state = await this.persistence.load(sessionId);
    if (!state) return null;

    for (const branchId of state.branch_order) {
      const branch = state.branches[branchId];
      if (branch.status === "exploring") {
        return branch;
      }
    }
    return null;
  }

  async isSessionComplete(sessionId: string): Promise<boolean> {
    const state = await this.persistence.load(sessionId);
    if (!state) return false;

    return Object.values(state.branches).every((b) => b.status === "done");
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.persistence.delete(sessionId);
  }
}
```

**Step 4: Update index export**

Modify `src/state/index.ts`:

```typescript
// src/state/index.ts
export * from "./types";
export * from "./persistence";
export * from "./manager";
```

**Step 5: Run test to verify it passes**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/state/manager.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): add StateManager for branch-based session management"
```

---

## Task 4: Update Bootstrapper Agent for Branch Creation

**Files:**
- Modify: `src/agents/bootstrapper.ts`
- Create: `tests/agents/bootstrapper.test.ts`

**Step 1: Write the failing test**

Create `tests/agents/bootstrapper.test.ts`:

```typescript
// tests/agents/bootstrapper.test.ts
import { describe, it, expect } from "bun:test";
import { bootstrapperAgent } from "../src/agents/bootstrapper";

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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/agents/bootstrapper.test.ts`

Expected: FAIL - prompt does not contain "branches"

**Step 3: Update bootstrapper agent**

Modify `src/agents/bootstrapper.ts`:

```typescript
// src/agents/bootstrapper.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const bootstrapperAgent: AgentConfig = {
  description: "Analyzes a request and creates exploration branches with scopes",
  mode: "subagent",
  model: "anthropic/claude-opus-4-5",
  temperature: 0.5,
  prompt: `<purpose>
Analyze the user's request and create 2-4 exploration branches.
Each branch explores ONE specific aspect of the design.
</purpose>

<output-format>
Return ONLY a JSON object. No markdown, no explanation.

{
  "branches": [
    {
      "id": "unique_snake_case_id",
      "scope": "One sentence describing what this branch explores",
      "initial_question": {
        "type": "pick_one|pick_many|ask_text|confirm",
        "config": { ... }
      }
    }
  ]
}
</output-format>

<branch-guidelines>
<guideline>Each branch explores ONE distinct aspect (not overlapping)</guideline>
<guideline>Scope is a clear boundary - questions stay within scope</guideline>
<guideline>2-4 branches total - don't over-decompose</guideline>
<guideline>Branch IDs are short snake_case identifiers</guideline>
</branch-guidelines>

<example>
Request: "Add healthcheck endpoints to the API"

{
  "branches": [
    {
      "id": "services",
      "scope": "Which services and dependencies need health monitoring",
      "initial_question": {
        "type": "pick_many",
        "config": {
          "question": "Which services should the healthcheck monitor?",
          "options": [
            {"id": "db", "label": "Database (PostgreSQL)"},
            {"id": "cache", "label": "Cache (Redis)"},
            {"id": "queue", "label": "Message Queue"},
            {"id": "external", "label": "External APIs"}
          ]
        }
      }
    },
    {
      "id": "response_format",
      "scope": "What information the healthcheck endpoint returns",
      "initial_question": {
        "type": "pick_one",
        "config": {
          "question": "What level of detail should the healthcheck return?",
          "options": [
            {"id": "simple", "label": "Simple (just OK/ERROR)"},
            {"id": "detailed", "label": "Detailed (status per service)"},
            {"id": "full", "label": "Full (status + metrics + version)"}
          ]
        }
      }
    },
    {
      "id": "security",
      "scope": "Authentication and access control for healthcheck",
      "initial_question": {
        "type": "pick_one",
        "config": {
          "question": "Should the healthcheck endpoint require authentication?",
          "options": [
            {"id": "public", "label": "Public (no auth)"},
            {"id": "internal", "label": "Internal only (IP whitelist)"},
            {"id": "authenticated", "label": "Requires API key"}
          ]
        }
      }
    }
  ]
}
</example>

<question-types>
<type name="pick_one">config: { question, options: [{id, label, description?}], recommended? }</type>
<type name="pick_many">config: { question, options: [{id, label}], min?, max? }</type>
<type name="ask_text">config: { question, placeholder?, multiline? }</type>
<type name="confirm">config: { question, context? }</type>
</question-types>

<never-do>
<forbidden>Never create more than 4 branches</forbidden>
<forbidden>Never create overlapping scopes</forbidden>
<forbidden>Never wrap output in markdown code blocks</forbidden>
<forbidden>Never include text outside the JSON</forbidden>
</never-do>`,
};
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/agents/bootstrapper.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/bootstrapper.ts tests/agents/bootstrapper.test.ts
git commit -m "feat(agents): update bootstrapper to create exploration branches"
```

---

## Task 5: Create Branch Probe Agent

**Files:**
- Modify: `src/agents/probe.ts`
- Create: `tests/agents/probe.test.ts`

**Step 1: Write the failing test**

Create `tests/agents/probe.test.ts`:

```typescript
// tests/agents/probe.test.ts
import { describe, it, expect } from "bun:test";
import { probeAgent } from "../src/agents/probe";

describe("probeAgent", () => {
  it("should have correct configuration", () => {
    expect(probeAgent.mode).toBe("subagent");
    expect(probeAgent.model).toBe("anthropic/claude-opus-4-5");
  });

  it("should have prompt that works within branch scope", () => {
    expect(probeAgent.prompt).toContain("scope");
    expect(probeAgent.prompt).toContain("branch");
    expect(probeAgent.prompt).toContain("finding");
  });

  it("should output done with finding OR next question", () => {
    expect(probeAgent.prompt).toContain("done");
    expect(probeAgent.prompt).toContain("question");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/agents/probe.test.ts`

Expected: FAIL - prompt doesn't contain required terms

**Step 3: Update probe agent**

Modify `src/agents/probe.ts`:

```typescript
// src/agents/probe.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const probeAgent: AgentConfig = {
  description: "Analyzes branch context and decides next question or completion with finding",
  mode: "subagent",
  model: "anthropic/claude-opus-4-5",
  temperature: 0.5,
  prompt: `<purpose>
You are exploring ONE branch of a brainstorming session.
Analyze the conversation within this branch's scope and decide:
1. If we have enough info, mark done with a finding
2. If not, ask ONE follow-up question (within scope)
</purpose>

<input-context>
You will receive:
- Branch scope: what aspect this branch explores
- Questions asked so far in this branch
- Answers received
</input-context>

<output-format>
Return ONLY a JSON object. No markdown, no explanation.

If branch exploration is complete:
{
  "done": true,
  "reason": "Brief explanation",
  "finding": "One-sentence summary of what we learned in this branch"
}

If more exploration needed:
{
  "done": false,
  "reason": "What we still need to learn",
  "question": {
    "type": "pick_one|pick_many|ask_text|confirm",
    "config": { ... }
  }
}
</output-format>

<scope-rules>
<rule>ONLY ask questions within the branch scope</rule>
<rule>If a question would be outside scope, mark done instead</rule>
<rule>2-4 questions per branch is typical - don't over-explore</rule>
<rule>The finding summarizes what we learned for the final design</rule>
</scope-rules>

<completion-criteria>
Mark done: true when ANY of these is true:
- Core question of the scope is answered
- User gave enough info to proceed
- Asking more would go outside the scope
- 3-4 questions already asked in this branch
</completion-criteria>

<question-types>
<type name="pick_one">config: { question, options: [{id, label, description?}], recommended? }</type>
<type name="pick_many">config: { question, options: [{id, label}], min?, max? }</type>
<type name="ask_text">config: { question, placeholder?, multiline? }</type>
<type name="confirm">config: { question, context? }</type>
</question-types>

<never-do>
<forbidden>Never ask questions outside the branch scope</forbidden>
<forbidden>Never ask more than 1 question per response</forbidden>
<forbidden>Never repeat a question already asked in this branch</forbidden>
<forbidden>Never wrap output in markdown code blocks</forbidden>
</never-do>`,
};
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/agents/probe.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/probe.ts tests/agents/probe.test.ts
git commit -m "feat(agents): update probe to work within branch scope"
```

---

## Task 6: Create Branch-Aware Tools

**Files:**
- Create: `src/tools/branch.ts`
- Modify: `src/tools/index.ts`
- Create: `tests/tools/branch.test.ts`

**Step 1: Write the failing test**

Create `tests/tools/branch.test.ts`:

```typescript
// tests/tools/branch.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rmSync } from "fs";
import { createBranchTools } from "../src/tools/branch";
import { StateManager } from "../src/state/manager";
import { SessionManager } from "../src/session/manager";

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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/tools/branch.test.ts`

Expected: FAIL - module not found

**Step 3: Write implementation**

Create `src/tools/branch.ts`:

```typescript
// src/tools/branch.ts
import type { ToolConfig } from "@opencode-ai/plugin/tool";
import type { StateManager } from "../state/manager";
import type { SessionManager } from "../session/manager";
import type { QuestionType, QuestionConfig } from "../session/types";

interface BranchInput {
  id: string;
  scope: string;
  initial_question: {
    type: QuestionType;
    config: QuestionConfig;
  };
}

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = `${prefix}_`;
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function createBranchTools(stateManager: StateManager, sessionManager: SessionManager) {
  const create_brainstorm: ToolConfig<{ request: string; branches: BranchInput[] }, string> = {
    description: "Create a new brainstorm session with exploration branches",
    parameters: {
      type: "object",
      properties: {
        request: { type: "string", description: "The original user request" },
        branches: {
          type: "array",
          description: "Branches to explore",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              scope: { type: "string" },
              initial_question: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  config: { type: "object" },
                },
              },
            },
          },
        },
      },
      required: ["request", "branches"],
    },
    async execute(args) {
      const sessionId = generateId("ses");

      // Create state with branches
      await stateManager.createSession(
        sessionId,
        args.request,
        args.branches.map((b) => ({ id: b.id, scope: b.scope })),
      );

      // Start browser session with first questions from each branch
      const initialQuestions = args.branches.map((b) => ({
        type: b.initial_question.type,
        config: b.initial_question.config,
      }));

      const browserSession = await sessionManager.startSession({
        title: "Brainstorming Session",
        questions: initialQuestions,
      });

      await stateManager.setBrowserSessionId(sessionId, browserSession.session_id);

      // Record initial questions in state
      for (let i = 0; i < args.branches.length; i++) {
        const branch = args.branches[i];
        const questionId = browserSession.question_ids?.[i];
        if (questionId) {
          const questionText =
            typeof branch.initial_question.config === "object" &&
            "question" in branch.initial_question.config
              ? String(branch.initial_question.config.question)
              : "Question";

          await stateManager.addQuestionToBranch(sessionId, branch.id, {
            id: questionId,
            type: branch.initial_question.type,
            text: questionText,
            config: branch.initial_question.config,
          });
        }
      }

      const branchList = args.branches.map((b) => `- ${b.id}: ${b.scope}`).join("\n");
      return `## Brainstorm Session Created

**Session ID:** ${sessionId}
**Browser Session:** ${browserSession.session_id}
**URL:** ${browserSession.url}

**Branches:**
${branchList}

Call get_next_answer(session_id="${browserSession.session_id}", block=true) to collect answers.`;
    },
  };

  const get_branch_status: ToolConfig<{ session_id: string; branch_id: string }, string> = {
    description: "Get the current status and context of a branch",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Brainstorm session ID" },
        branch_id: { type: "string", description: "Branch ID" },
      },
      required: ["session_id", "branch_id"],
    },
    async execute(args) {
      const state = await stateManager.getSession(args.session_id);
      if (!state) return `Error: Session not found: ${args.session_id}`;

      const branch = state.branches[args.branch_id];
      if (!branch) return `Error: Branch not found: ${args.branch_id}`;

      const qas = branch.questions
        .map((q, i) => {
          const answerText = q.answer ? JSON.stringify(q.answer) : "(pending)";
          return `Q${i + 1}: ${q.text}\nA${i + 1}: ${answerText}`;
        })
        .join("\n\n");

      return `## Branch: ${args.branch_id}

**Scope:** ${branch.scope}
**Status:** ${branch.status}
**Finding:** ${branch.finding || "(none yet)"}

**Questions & Answers:**
${qas || "(no questions yet)"}`;
    },
  };

  const complete_branch: ToolConfig<
    { session_id: string; branch_id: string; finding: string },
    string
  > = {
    description: "Mark a branch as done with its finding",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Brainstorm session ID" },
        branch_id: { type: "string", description: "Branch ID" },
        finding: { type: "string", description: "Summary of what was learned" },
      },
      required: ["session_id", "branch_id", "finding"],
    },
    async execute(args) {
      await stateManager.completeBranch(args.session_id, args.branch_id, args.finding);
      return `## Branch Completed

**Branch:** ${args.branch_id}
**Status:** done
**Finding:** ${args.finding}`;
    },
  };

  const push_branch_question: ToolConfig<
    {
      session_id: string;
      branch_id: string;
      question: { type: QuestionType; config: QuestionConfig };
    },
    string
  > = {
    description: "Push a new question to a branch",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Brainstorm session ID" },
        branch_id: { type: "string", description: "Branch ID" },
        question: {
          type: "object",
          description: "Question to push",
          properties: {
            type: { type: "string" },
            config: { type: "object" },
          },
        },
      },
      required: ["session_id", "branch_id", "question"],
    },
    async execute(args) {
      const state = await stateManager.getSession(args.session_id);
      if (!state) return `Error: Session not found: ${args.session_id}`;
      if (!state.browser_session_id) return `Error: No browser session`;

      const questionId = generateId("q");
      const questionText =
        typeof args.question.config === "object" && "question" in args.question.config
          ? String((args.question.config as { question: string }).question)
          : "Question";

      // Push to browser
      sessionManager.pushQuestion(state.browser_session_id, args.question.type, args.question.config);

      // Record in state
      await stateManager.addQuestionToBranch(args.session_id, args.branch_id, {
        id: questionId,
        type: args.question.type,
        text: questionText,
        config: args.question.config,
      });

      return `## Question Pushed

**Branch:** ${args.branch_id}
**Question ID:** ${questionId}
**Question:** ${questionText}

Call get_next_answer to collect the response.`;
    },
  };

  const get_session_summary: ToolConfig<{ session_id: string }, string> = {
    description: "Get summary of all branches and their findings",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Brainstorm session ID" },
      },
      required: ["session_id"],
    },
    async execute(args) {
      const state = await stateManager.getSession(args.session_id);
      if (!state) return `Error: Session not found: ${args.session_id}`;

      const branchSummaries = state.branch_order
        .map((id) => {
          const b = state.branches[id];
          const status = b.status === "done" ? "DONE" : "EXPLORING";
          const finding = b.finding || "(no finding yet)";
          return `### ${id} [${status}]\n**Scope:** ${b.scope}\n**Finding:** ${finding}`;
        })
        .join("\n\n");

      const allDone = Object.values(state.branches).every((b) => b.status === "done");

      return `## Session Summary

**Request:** ${state.request}
**Status:** ${allDone ? "COMPLETE" : "IN PROGRESS"}

${branchSummaries}`;
    },
  };

  const end_brainstorm: ToolConfig<{ session_id: string }, string> = {
    description: "End a brainstorm session and get final summary",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Brainstorm session ID" },
      },
      required: ["session_id"],
    },
    async execute(args) {
      const state = await stateManager.getSession(args.session_id);
      if (!state) return `Error: Session not found: ${args.session_id}`;

      // End browser session
      if (state.browser_session_id) {
        await sessionManager.endSession(state.browser_session_id);
      }

      // Build final summary
      const findings = state.branch_order
        .map((id) => {
          const b = state.branches[id];
          return `- **${b.scope}:** ${b.finding || "(no finding)"}`;
        })
        .join("\n");

      // Clean up state file
      await stateManager.deleteSession(args.session_id);

      return `## Brainstorm Complete

**Request:** ${state.request}

### Findings

${findings}

Write the design document based on these findings.`;
    },
  };

  return {
    create_brainstorm,
    get_branch_status,
    complete_branch,
    push_branch_question,
    get_session_summary,
    end_brainstorm,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/tools/branch.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/branch.ts tests/tools/branch.test.ts
git commit -m "feat(tools): add branch-aware brainstorming tools"
```

---

## Task 7: Update Brainstormer Agent

**Files:**
- Modify: `src/agents/brainstormer.ts`

**Step 1: Update brainstormer agent**

Modify `src/agents/brainstormer.ts`:

```typescript
// src/agents/brainstormer.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const brainstormerAgent: AgentConfig = {
  description: "Runs interactive brainstorming sessions using branch-based exploration",
  mode: "primary",
  model: "anthropic/claude-opus-4-5",
  temperature: 0.7,
  prompt: `<purpose>
Run brainstorming sessions using branch-based exploration.
Each branch explores one aspect of the design within its scope.
</purpose>

<workflow>
1. BOOTSTRAP: Call bootstrapper subagent to create branches
   background_task(agent="bootstrapper", prompt="Create branches for: {request}")
   Parse the JSON response to get branches array

2. CREATE SESSION: Create brainstorm with branches
   create_brainstorm(request="{request}", branches=[...parsed branches...])
   Save both session_id and browser_session_id

3. COLLECT ANSWERS: Loop until all branches done
   For each answer:
   a. get_next_answer(session_id=browser_session_id, block=true)
   b. Identify which branch the question belongs to
   c. Call probe for that branch:
      background_task(agent="probe", prompt="Branch scope: {scope}\\nQuestions: {qa_history}")
   d. If probe says done: complete_branch(session_id, branch_id, finding)
   e. If probe has question: push_branch_question(session_id, branch_id, question)
   f. Check get_session_summary to see progress

4. WHEN ALL DONE:
   end_brainstorm(session_id)
   Write design document to docs/plans/YYYY-MM-DD-{topic}-design.md
</workflow>

<tools>
- create_brainstorm(request, branches): Start session with branches
- get_branch_status(session_id, branch_id): Get branch context for probe
- complete_branch(session_id, branch_id, finding): Mark branch done
- push_branch_question(session_id, branch_id, question): Add question to branch
- get_session_summary(session_id): See all branches status
- end_brainstorm(session_id): End session, get findings
- get_next_answer(session_id, block): Collect user answers (use browser_session_id)
</tools>

<important>
- Use branch_id to route answers to correct branch
- Each branch gets its own probe calls with only its Q&A history
- The probe ONLY sees its branch's scope and questions
- This prevents duplicate questions across branches
</important>

<design-document>
After end_brainstorm, write to docs/plans/YYYY-MM-DD-{topic}-design.md:
- Problem statement (from original request)
- Findings by branch (each branch's finding)
- Recommended approach (synthesize findings)
</design-document>`,
};
```

**Step 2: Verify syntax**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun run typecheck 2>&1 || echo "Typecheck complete"`

Expected: No errors

**Step 3: Commit**

```bash
git add src/agents/brainstormer.ts
git commit -m "feat(agents): update brainstormer for branch-based exploration"
```

---

## Task 8: Update Plugin Index (Remove Hooks)

**Files:**
- Modify: `src/index.ts`
- Modify: `src/tools/index.ts`

**Step 1: Update tools index to include branch tools**

Modify `src/tools/index.ts`:

```typescript
// src/tools/index.ts
import type { SessionManager } from "../session/manager";
import type { OpencodeClient } from "@opencode-ai/sdk";
import { createSessionTools } from "./session";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createPushQuestionTool } from "./push-question";
import { createBranchTools } from "./branch";
import { StateManager } from "../state/manager";

export function createBrainstormerTools(manager: SessionManager, _client?: OpencodeClient) {
  const stateManager = new StateManager();

  return {
    ...createSessionTools(manager),
    ...createQuestionTools(manager),
    ...createResponseTools(manager),
    ...createPushQuestionTool(manager),
    ...createBranchTools(stateManager, manager),
  };
}
```

**Step 2: Simplify plugin index (remove hooks)**

Modify `src/index.ts`:

```typescript
// src/index.ts
import type { Plugin } from "@opencode-ai/plugin";
import { SessionManager } from "./session/manager";
import { createBrainstormerTools } from "./tools";
import { agents } from "./agents";

const BrainstormerPlugin: Plugin = async (ctx) => {
  const sessionManager = new SessionManager();
  const sessionsByOpenCodeSession = new Map<string, Set<string>>();

  const baseTools = createBrainstormerTools(sessionManager, ctx.client);

  // Wrap start_session to track for cleanup
  const originalStartSession = baseTools.start_session;
  const wrappedStartSession = {
    ...originalStartSession,
    execute: async (args: Record<string, unknown>, toolCtx: import("@opencode-ai/plugin/tool").ToolContext) => {
      type StartSessionArgs = Parameters<typeof originalStartSession.execute>[0];
      const result = await originalStartSession.execute(args as StartSessionArgs, toolCtx);

      const sessionIdMatch = result.match(/ses_[a-z0-9]+/);
      if (sessionIdMatch && toolCtx.sessionID) {
        const brainstormSessionId = sessionIdMatch[0];
        const openCodeSessionId = toolCtx.sessionID;

        if (!sessionsByOpenCodeSession.has(openCodeSessionId)) {
          sessionsByOpenCodeSession.set(openCodeSessionId, new Set());
        }
        sessionsByOpenCodeSession.get(openCodeSessionId)!.add(brainstormSessionId);
      }

      return result;
    },
  };

  return {
    tool: {
      ...baseTools,
      start_session: wrappedStartSession,
    },

    config: async (config) => {
      config.agent = {
        ...config.agent,
        ...agents,
      };
    },

    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } } | undefined;
        const openCodeSessionId = props?.info?.id;

        if (openCodeSessionId) {
          const brainstormerSessions = sessionsByOpenCodeSession.get(openCodeSessionId);
          if (brainstormerSessions) {
            for (const sessionId of brainstormerSessions) {
              await sessionManager.endSession(sessionId);
            }
            sessionsByOpenCodeSession.delete(openCodeSessionId);
          }
        }
      }
    },
  };
};

export default BrainstormerPlugin;

export type * from "./types";
export type * from "./tools/brainstorm/types";
```

**Step 3: Run tests to verify nothing broke**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test`

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/index.ts src/tools/index.ts
git commit -m "refactor(plugin): remove hook-based probe, use branch tools"
```

---

## Task 9: Add Integration Test

**Files:**
- Create: `tests/integration/branch-flow.test.ts`

**Step 1: Write integration test**

Create `tests/integration/branch-flow.test.ts`:

```typescript
// tests/integration/branch-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rmSync } from "fs";
import { StateManager } from "../../src/state/manager";
import { SessionManager } from "../../src/session/manager";
import { createBranchTools } from "../../src/tools/branch";

const TEST_DIR = "/tmp/brainstorm-integration-test";

describe("Branch-Based Brainstorm Flow", () => {
  let stateManager: StateManager;
  let sessionManager: SessionManager;
  let tools: ReturnType<typeof createBranchTools>;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    stateManager = new StateManager(TEST_DIR);
    sessionManager = new SessionManager({ skipBrowser: true });
    tools = createBranchTools(stateManager, sessionManager);
  });

  afterEach(async () => {
    await sessionManager.cleanup();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should run complete brainstorm flow with multiple branches", async () => {
    // 1. Create brainstorm with two branches
    const createResult = await tools.create_brainstorm.execute({
      request: "Add healthcheck endpoints",
      branches: [
        {
          id: "services",
          scope: "Which services need monitoring",
          initial_question: {
            type: "pick_many",
            config: {
              question: "Which services?",
              options: [
                { id: "db", label: "Database" },
                { id: "cache", label: "Cache" },
              ],
            },
          },
        },
        {
          id: "format",
          scope: "Response format for healthcheck",
          initial_question: {
            type: "pick_one",
            config: {
              question: "What format?",
              options: [
                { id: "simple", label: "Simple" },
                { id: "detailed", label: "Detailed" },
              ],
            },
          },
        },
      ],
    }, {} as any);

    expect(createResult).toContain("ses_");
    expect(createResult).toContain("services");
    expect(createResult).toContain("format");

    // Extract session ID
    const sessionIdMatch = createResult.match(/\*\*Session ID:\*\* (ses_[a-z0-9]+)/);
    expect(sessionIdMatch).not.toBeNull();
    const sessionId = sessionIdMatch![1];

    // 2. Check initial status
    const status1 = await tools.get_branch_status.execute({
      session_id: sessionId,
      branch_id: "services",
    }, {} as any);
    expect(status1).toContain("exploring");
    expect(status1).toContain("Which services need monitoring");

    // 3. Complete first branch
    await tools.complete_branch.execute({
      session_id: sessionId,
      branch_id: "services",
      finding: "Monitor PostgreSQL and Redis",
    }, {} as any);

    // 4. Push follow-up question to second branch
    await tools.push_branch_question.execute({
      session_id: sessionId,
      branch_id: "format",
      question: {
        type: "confirm",
        config: { question: "Include response times?" },
      },
    }, {} as any);

    // 5. Complete second branch
    await tools.complete_branch.execute({
      session_id: sessionId,
      branch_id: "format",
      finding: "Use detailed format with response times",
    }, {} as any);

    // 6. Get summary
    const summary = await tools.get_session_summary.execute({
      session_id: sessionId,
    }, {} as any);
    expect(summary).toContain("COMPLETE");
    expect(summary).toContain("Monitor PostgreSQL and Redis");
    expect(summary).toContain("detailed format");

    // 7. End session
    const endResult = await tools.end_brainstorm.execute({
      session_id: sessionId,
    }, {} as any);
    expect(endResult).toContain("Brainstorm Complete");
    expect(endResult).toContain("Monitor PostgreSQL and Redis");

    // 8. Verify cleanup
    const state = await stateManager.getSession(sessionId);
    expect(state).toBeNull();
  });
});
```

**Step 2: Run integration test**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test tests/integration/branch-flow.test.ts`

Expected: PASS

**Step 3: Run all tests**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test`

Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/integration/branch-flow.test.ts
git commit -m "test(integration): add branch-based brainstorm flow test"
```

---

## Task 10: Add .brainstorm to .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Update .gitignore**

Add to `.gitignore`:

```
# Brainstorm state files
.brainstorm/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .brainstorm state directory"
```

---

## Task 11: Final Verification

**Step 1: Run full test suite**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun test`

Expected: All tests pass

**Step 2: Run typecheck**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun run typecheck 2>&1 || tsc --noEmit`

Expected: No errors

**Step 3: Build (if applicable)**

Run: `cd /Users/whitemonk/projects/config/brainstormer && bun run build 2>&1 || echo "No build script"`

Expected: No errors

---

## Summary

This refactor replaces the fragile hook-based architecture with:

1. **State file persistence** - Session state saved to `.brainstorm/{session_id}.json`
2. **Branch-based exploration** - Each branch has a scope and only asks questions within it
3. **Agent-driven flow** - Brainstormer agent explicitly controls the flow, no hooks
4. **Scoped probes** - Each probe only sees its branch's Q&A history, preventing duplicates

Key benefits:
- No duplicate questions (branches have non-overlapping scopes)
- State survives across calls (file-based)
- Explicit control flow (easier to debug)
- Clear boundaries (each branch has one job)
