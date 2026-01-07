// src/tools/processor.ts

import type { Answer, SessionStore } from "@/session";
import { BRANCH_STATUSES, type StateStore } from "@/state";

import { evaluateBranch } from "./probe-logic";

export async function processAnswer(
  stateStore: StateStore,
  sessions: SessionStore,
  sessionId: string,
  browserSessionId: string,
  questionId: string,
  answer: Answer,
): Promise<void> {
  const state = await stateStore.getSession(sessionId);
  if (!state) return;

  // Find which branch this question belongs to
  let branchId: string | null = null;
  for (const [id, branch] of Object.entries(state.branches)) {
    if (branch.questions.some((q) => q.id === questionId)) {
      branchId = id;
      break;
    }
  }

  if (!branchId) return;
  if (state.branches[branchId].status === BRANCH_STATUSES.DONE) return;

  // Record the answer
  try {
    await stateStore.recordAnswer(sessionId, questionId, answer);
  } catch (error) {
    console.error(`[octto] Failed to record answer for ${questionId}:`, error);
    throw error;
  }

  // Get fresh state after recording
  const updatedState = await stateStore.getSession(sessionId);
  if (!updatedState) return;

  const branch = updatedState.branches[branchId];
  if (!branch || branch.status === BRANCH_STATUSES.DONE) return;

  // Evaluate and act
  const result = evaluateBranch(branch);

  if (result.done) {
    await stateStore.completeBranch(sessionId, branchId, result.finding || "No finding");
    return;
  }

  if (result.question) {
    const config = result.question.config as { question?: string; context?: string };
    const questionText = config.question ?? "Follow-up question";
    const existingContext = config.context ?? "";
    const configWithContext = {
      ...config,
      context: `[${branch.scope}] ${existingContext}`.trim(),
    };

    const { question_id: newQuestionId } = sessions.pushQuestion(
      browserSessionId,
      result.question.type,
      configWithContext,
    );

    await stateStore.addQuestionToBranch(sessionId, branchId, {
      id: newQuestionId,
      type: result.question.type,
      text: questionText,
      config: configWithContext,
    });
  }
}
