// src/tools/brainstorm/types.ts
import type { QuestionType, QuestionConfig } from "../../session/types";

/**
 * Input to the brainstorm tool
 */
export interface BrainstormInput {
  /** Background context the calling agent gathered */
  context: string;
  /** User's original request */
  request: string;
  /** Initial questions to display when browser opens */
  initial_questions: Array<{
    type: QuestionType;
    config: QuestionConfig;
  }>;
  /** Optional: Maximum number of follow-up questions (default: 15) */
  max_questions?: number;
  /** Optional: Model to use for internal LLM calls (default: anthropic/claude-sonnet-4) */
  model?: string;
}

/**
 * A single Q&A pair from the brainstorming session
 */
export interface BrainstormAnswer {
  /** The question text */
  question: string;
  /** Question type (pick_one, ask_text, etc.) */
  type: QuestionType;
  /** User's response (varies by type) */
  answer: unknown;
}

/**
 * Output from the brainstorm tool
 */
export interface BrainstormOutput {
  /** All Q&A pairs from the session */
  answers: BrainstormAnswer[];
  /** LLM-synthesized design document */
  summary: string;
}

/**
 * Probe LLM response when more questions needed
 */
export interface ProbeResponseContinue {
  done: false;
  reason: string;
  questions: Array<{
    type: QuestionType;
    config: QuestionConfig;
  }>;
}

/**
 * Probe LLM response when design is complete
 */
export interface ProbeResponseDone {
  done: true;
  reason: string;
}

export type ProbeResponse = ProbeResponseContinue | ProbeResponseDone;

/**
 * Error types for brainstorm tool
 */
export type BrainstormErrorType =
  | "session_closed"
  | "llm_error"
  | "timeout"
  | "invalid_response"
  | "max_questions_reached";

export class BrainstormError extends Error {
  constructor(
    public readonly type: BrainstormErrorType,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BrainstormError";
  }
}
