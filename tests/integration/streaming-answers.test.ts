// tests/integration/streaming-answers.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createSessionStore } from "../../src/session/sessions";

describe("Streaming Answer Processing", () => {
  let sessions: ReturnType<typeof createSessionStore>;

  beforeEach(() => {
    sessions = createSessionStore({ skipBrowser: true });
  });

  afterEach(async () => {
    await sessions.cleanup();
  });

  describe("Session flow with streaming answers", () => {
    it("should allow probe to be spawned after each answer", async () => {
      const { session_id } = await sessions.startSession({ title: "Streaming Test" });

      // Push 3 initial questions (simulating bootstrapper output)
      const q1 = sessions.pushQuestion(session_id, "pick_one", {
        question: "What's the primary goal?",
        options: [
          { id: "speed", label: "Fast" },
          { id: "simple", label: "Simple" },
        ],
      });
      const _q2 = sessions.pushQuestion(session_id, "ask_text", {
        question: "Any constraints?",
      });
      const q3 = sessions.pushQuestion(session_id, "pick_many", {
        question: "Which features?",
        options: [
          { id: "tags", label: "Tags" },
          { id: "due", label: "Due dates" },
        ],
      });

      // User answers Q1 first
      sessions.handleWsMessage(session_id, {
        type: "response",
        id: q1.question_id,
        answer: { selected: "simple" },
      });

      // get_next_answer should return Q1 immediately
      const r1 = await sessions.getNextAnswer({ session_id, block: false });
      expect(r1.completed).toBe(true);
      expect(r1.question_id).toBe(q1.question_id);
      expect(r1.response).toEqual({ selected: "simple" });

      // At this point, octto would spawn probe with partial context
      // Q2 and Q3 are still pending

      // User answers Q3 (out of order)
      sessions.handleWsMessage(session_id, {
        type: "response",
        id: q3.question_id,
        answer: { selected: ["tags"] },
      });

      // get_next_answer should return Q3
      const r3 = await sessions.getNextAnswer({ session_id, block: false });
      expect(r3.completed).toBe(true);
      expect(r3.question_id).toBe(q3.question_id);

      // Q2 still pending
      const r2check = await sessions.getNextAnswer({ session_id, block: false });
      expect(r2check.completed).toBe(false);
      expect(r2check.status).toBe("pending");
    });

    it("should handle probe adding new question while others pending", async () => {
      const { session_id } = await sessions.startSession({ title: "Dynamic Questions" });

      // Initial questions
      const q1 = sessions.pushQuestion(session_id, "confirm", { question: "Ready?" });
      const _q2 = sessions.pushQuestion(session_id, "ask_text", { question: "Details?" });

      // Answer Q1
      sessions.handleWsMessage(session_id, {
        type: "response",
        id: q1.question_id,
        answer: { choice: "yes" },
      });

      await sessions.getNextAnswer({ session_id, block: false });

      // Probe adds a new question (Q3) while Q2 still pending
      const q3 = sessions.pushQuestion(session_id, "pick_one", {
        question: "Follow-up from probe?",
        options: [{ id: "a", label: "Option A" }],
      });

      // List should show Q2 (pending) and Q3 (pending)
      const list = sessions.listQuestions(session_id);
      const pendingQuestions = list.questions.filter((q) => q.status === "pending");
      expect(pendingQuestions.length).toBe(2);

      // User can answer either Q2 or Q3 next
      sessions.handleWsMessage(session_id, {
        type: "response",
        id: q3.question_id,
        answer: { selected: "a" },
      });

      const r3 = await sessions.getNextAnswer({ session_id, block: false });
      expect(r3.completed).toBe(true);
      expect(r3.question_id).toBe(q3.question_id);
    });
  });
});
