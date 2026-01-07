// tests/integration/full-flow.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createSessionStore } from "../../src/session/sessions";

describe("Full Flow Integration", () => {
  let sessions: ReturnType<typeof createSessionStore>;

  beforeEach(() => {
    sessions = createSessionStore({ skipBrowser: true });
  });

  afterEach(async () => {
    await sessions.cleanup();
  });

  it("should handle complete question-answer flow", async () => {
    // 1. Start session
    const { session_id, url } = await sessions.startSession({ title: "Integration Test" });
    expect(session_id).toBeTruthy();
    expect(url).toContain("localhost");

    // 2. Push a question
    const { question_id } = sessions.pushQuestion(session_id, "confirm", {
      question: "Do you approve?",
    });
    expect(question_id).toBeTruthy();

    // 3. Check status (should be pending)
    const pendingResult = await sessions.getAnswer({ question_id, block: false });
    expect(pendingResult.completed).toBe(false);
    expect(pendingResult.status).toBe("pending");

    // 4. Simulate WebSocket response
    sessions.handleWsMessage(session_id, {
      type: "response",
      id: question_id,
      answer: { choice: "yes" },
    });

    // 5. Check status (should be answered)
    const answeredResult = await sessions.getAnswer({ question_id, block: false });
    expect(answeredResult.completed).toBe(true);
    expect(answeredResult.status).toBe("answered");
    expect(answeredResult.response).toEqual({ choice: "yes" });

    // 6. End session
    const endResult = await sessions.endSession(session_id);
    expect(endResult.ok).toBe(true);
  });

  it("should handle multiple questions in queue", async () => {
    const { session_id } = await sessions.startSession({});

    // Push multiple questions
    const q1 = sessions.pushQuestion(session_id, "confirm", { question: "Q1?" });
    const q2 = sessions.pushQuestion(session_id, "confirm", { question: "Q2?" });
    const q3 = sessions.pushQuestion(session_id, "confirm", { question: "Q3?" });

    // List should show all 3
    const list = sessions.listQuestions(session_id);
    expect(list.questions.length).toBe(3);

    // Answer in order
    sessions.handleWsMessage(session_id, { type: "response", id: q1.question_id, answer: { choice: "yes" } });
    sessions.handleWsMessage(session_id, { type: "response", id: q2.question_id, answer: { choice: "no" } });
    sessions.handleWsMessage(session_id, { type: "response", id: q3.question_id, answer: { choice: "yes" } });

    // All should be answered
    const r1 = await sessions.getAnswer({ question_id: q1.question_id, block: false });
    const r2 = await sessions.getAnswer({ question_id: q2.question_id, block: false });
    const r3 = await sessions.getAnswer({ question_id: q3.question_id, block: false });

    expect(r1.response).toEqual({ choice: "yes" });
    expect(r2.response).toEqual({ choice: "no" });
    expect(r3.response).toEqual({ choice: "yes" });
  });

  it("should handle blocking get_answer with timeout", async () => {
    const { session_id } = await sessions.startSession({});
    const { question_id } = sessions.pushQuestion(session_id, "confirm", { question: "Test?" });

    // Start blocking call with short timeout
    const startTime = Date.now();
    const result = await sessions.getAnswer({ question_id, block: true, timeout: 100 });
    const elapsed = Date.now() - startTime;

    // Should timeout
    expect(result.completed).toBe(false);
    expect(result.status).toBe("timeout");
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(500); // Should not wait much longer
  });

  it("should return answers in user order with get_next_answer", async () => {
    const { session_id } = await sessions.startSession({});

    // Push 3 questions
    const q1 = sessions.pushQuestion(session_id, "confirm", { question: "Q1?" });
    const _q2 = sessions.pushQuestion(session_id, "confirm", { question: "Q2?" });
    const q3 = sessions.pushQuestion(session_id, "confirm", { question: "Q3?" });

    // User answers q3 first, then q1, then q2
    sessions.handleWsMessage(session_id, { type: "response", id: q3.question_id, answer: { choice: "yes" } });

    // get_next_answer should return q3 (answered first)
    const r1 = await sessions.getNextAnswer({ session_id, block: false });
    expect(r1.completed).toBe(true);
    expect(r1.question_id).toBe(q3.question_id);
    expect(r1.response).toEqual({ choice: "yes" });

    // Calling get_next_answer again without new answers should return pending (q3 already retrieved)
    const r1b = await sessions.getNextAnswer({ session_id, block: false });
    expect(r1b.completed).toBe(false);
    expect(r1b.status).toBe("pending");

    // Answer q1
    sessions.handleWsMessage(session_id, { type: "response", id: q1.question_id, answer: { choice: "no" } });

    // get_next_answer should return q1 (not q3 again)
    const r2 = await sessions.getNextAnswer({ session_id, block: false });
    expect(r2.completed).toBe(true);
    expect(r2.question_id).toBe(q1.question_id);
    expect(r2.response).toEqual({ choice: "no" });
  });

  it("should wait for any answer with get_next_answer blocking", async () => {
    const { session_id } = await sessions.startSession({});

    // Push questions
    sessions.pushQuestion(session_id, "confirm", { question: "Q1?" });
    const q2 = sessions.pushQuestion(session_id, "confirm", { question: "Q2?" });

    // Start blocking get_next_answer
    const answerPromise = sessions.getNextAnswer({ session_id, block: true, timeout: 5000 });

    // Answer q2 after a small delay
    setTimeout(() => {
      sessions.handleWsMessage(session_id, { type: "response", id: q2.question_id, answer: { choice: "yes" } });
    }, 50);

    const result = await answerPromise;
    expect(result.completed).toBe(true);
    expect(result.question_id).toBe(q2.question_id);
  });
});
