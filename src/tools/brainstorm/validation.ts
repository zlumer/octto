// src/tools/brainstorm/validation.ts
// Runtime validation for LLM responses

import type { QuestionType } from "../../session/types";
import type { ProbeResponse, ProbeResponseDone, ProbeResponseContinue } from "./types";

/** All valid question types */
const VALID_QUESTION_TYPES: readonly string[] = [
  "pick_one",
  "pick_many",
  "confirm",
  "rank",
  "rate",
  "ask_text",
  "ask_image",
  "ask_file",
  "ask_code",
  "show_diff",
  "show_plan",
  "show_options",
  "review_section",
  "thumbs",
  "emoji_react",
  "slider",
] as const;

/**
 * Type guard to check if a value is a valid QuestionType
 */
export function isValidQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && VALID_QUESTION_TYPES.includes(value);
}

/**
 * Type guard for ProbeResponseDone
 */
export function isProbeResponseDone(value: unknown): value is ProbeResponseDone {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return obj.done === true && typeof obj.reason === "string";
}

/**
 * Type guard for ProbeResponseContinue
 */
export function isProbeResponseContinue(value: unknown): value is ProbeResponseContinue {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;

  if (obj.done !== false || typeof obj.reason !== "string") {
    return false;
  }

  if (obj.question === null || typeof obj.question !== "object") {
    return false;
  }

  const question = obj.question as Record<string, unknown>;
  if (!isValidQuestionType(question.type)) {
    return false;
  }

  if (question.config === null || typeof question.config !== "object") {
    return false;
  }

  return true;
}

/**
 * Type guard for ProbeResponse (either done or continue)
 */
export function isProbeResponse(value: unknown): value is ProbeResponse {
  return isProbeResponseDone(value) || isProbeResponseContinue(value);
}

// Answer type guards for each question type

/**
 * Type guard for pick_one answer
 */
export function isPickOneAnswer(value: unknown): value is { selected: string; other?: string } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.selected !== "string") return false;
  if (obj.other !== undefined && typeof obj.other !== "string") return false;
  return true;
}

/**
 * Type guard for pick_many answer
 */
export function isPickManyAnswer(value: unknown): value is { selected: string[]; other?: string[] } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.selected)) return false;
  if (!obj.selected.every((item) => typeof item === "string")) return false;
  return true;
}

/**
 * Type guard for confirm answer
 */
export function isConfirmAnswer(value: unknown): value is { choice: "yes" | "no" | "cancel" } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return obj.choice === "yes" || obj.choice === "no" || obj.choice === "cancel";
}

/**
 * Type guard for ask_text answer
 */
export function isAskTextAnswer(value: unknown): value is { text: string } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.text === "string";
}

/**
 * Type guard for slider answer
 */
export function isSliderAnswer(value: unknown): value is { value: number } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.value === "number";
}

/**
 * Type guard for thumbs answer
 */
export function isThumbsAnswer(value: unknown): value is { choice: "up" | "down" } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return obj.choice === "up" || obj.choice === "down";
}

/**
 * Type guard for rank answer
 */
export function isRankAnswer(value: unknown): value is { ranking: string[] } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.ranking)) return false;
  return obj.ranking.every((item) => typeof item === "string");
}

/**
 * Type guard for rate answer
 */
export function isRateAnswer(value: unknown): value is { ratings: Record<string, number> } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.ratings === null || typeof obj.ratings !== "object") return false;
  const ratings = obj.ratings as Record<string, unknown>;
  return Object.values(ratings).every((v) => typeof v === "number");
}

/**
 * Type guard for show_options answer
 */
export function isShowOptionsAnswer(value: unknown): value is { selected: string; feedback?: string } {
  if (value === null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.selected !== "string") return false;
  if (obj.feedback !== undefined && typeof obj.feedback !== "string") return false;
  return true;
}
