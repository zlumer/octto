// tests/tools/brainstorm/validation.test.ts
import { describe, it, expect } from "bun:test";
import {
  isProbeResponse,
  isProbeResponseDone,
  isProbeResponseContinue,
  isValidQuestionType,
  isPickOneAnswer,
  isPickManyAnswer,
  isConfirmAnswer,
  isAskTextAnswer,
  isSliderAnswer,
  isThumbsAnswer,
  isRankAnswer,
  isRateAnswer,
  isShowOptionsAnswer,
} from "../../../src/tools/brainstorm/validation";

describe("validation", () => {
  describe("isValidQuestionType", () => {
    it("should return true for valid question types", () => {
      expect(isValidQuestionType("pick_one")).toBe(true);
      expect(isValidQuestionType("pick_many")).toBe(true);
      expect(isValidQuestionType("confirm")).toBe(true);
      expect(isValidQuestionType("ask_text")).toBe(true);
      expect(isValidQuestionType("slider")).toBe(true);
    });

    it("should return false for invalid question types", () => {
      expect(isValidQuestionType("invalid")).toBe(false);
      expect(isValidQuestionType("")).toBe(false);
      expect(isValidQuestionType(null)).toBe(false);
      expect(isValidQuestionType(undefined)).toBe(false);
      expect(isValidQuestionType(123)).toBe(false);
    });
  });

  describe("isProbeResponseDone", () => {
    it("should return true for valid done response", () => {
      const response = { done: true, reason: "Design complete" };
      expect(isProbeResponseDone(response)).toBe(true);
    });

    it("should return false when done is false", () => {
      const response = { done: false, reason: "Need more info" };
      expect(isProbeResponseDone(response)).toBe(false);
    });

    it("should return false for non-objects", () => {
      expect(isProbeResponseDone(null)).toBe(false);
      expect(isProbeResponseDone(undefined)).toBe(false);
      expect(isProbeResponseDone("string")).toBe(false);
      expect(isProbeResponseDone(123)).toBe(false);
    });

    it("should return false when done is not boolean", () => {
      expect(isProbeResponseDone({ done: "true", reason: "test" })).toBe(false);
      expect(isProbeResponseDone({ done: 1, reason: "test" })).toBe(false);
    });

    it("should return false when reason is missing", () => {
      expect(isProbeResponseDone({ done: true })).toBe(false);
    });
  });

  describe("isProbeResponseContinue", () => {
    it("should return true for valid continue response", () => {
      const response = {
        done: false,
        reason: "Need more info",
        question: {
          type: "pick_one",
          config: { question: "Test?", options: [] },
        },
      };
      expect(isProbeResponseContinue(response)).toBe(true);
    });

    it("should return false when done is true", () => {
      const response = {
        done: true,
        reason: "Complete",
        question: { type: "pick_one", config: {} },
      };
      expect(isProbeResponseContinue(response)).toBe(false);
    });

    it("should return false when question is missing", () => {
      const response = { done: false, reason: "Need more" };
      expect(isProbeResponseContinue(response)).toBe(false);
    });

    it("should return false when question.type is invalid", () => {
      const response = {
        done: false,
        reason: "Need more",
        question: { type: "invalid_type", config: {} },
      };
      expect(isProbeResponseContinue(response)).toBe(false);
    });

    it("should return false when question.config is not an object", () => {
      const response = {
        done: false,
        reason: "Need more",
        question: { type: "pick_one", config: "not an object" },
      };
      expect(isProbeResponseContinue(response)).toBe(false);
    });
  });

  describe("isProbeResponse", () => {
    it("should return true for valid done response", () => {
      const response = { done: true, reason: "Complete" };
      expect(isProbeResponse(response)).toBe(true);
    });

    it("should return true for valid continue response", () => {
      const response = {
        done: false,
        reason: "Need more",
        question: { type: "confirm", config: { question: "Sure?" } },
      };
      expect(isProbeResponse(response)).toBe(true);
    });

    it("should return false for invalid responses", () => {
      expect(isProbeResponse(null)).toBe(false);
      expect(isProbeResponse({})).toBe(false);
      expect(isProbeResponse({ done: "maybe" })).toBe(false);
    });
  });

  describe("answer type guards", () => {
    describe("isPickOneAnswer", () => {
      it("should return true for valid pick_one answer", () => {
        expect(isPickOneAnswer({ selected: "opt1" })).toBe(true);
        expect(isPickOneAnswer({ selected: "opt1", other: "custom" })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isPickOneAnswer(null)).toBe(false);
        expect(isPickOneAnswer({})).toBe(false);
        expect(isPickOneAnswer({ selected: 123 })).toBe(false);
      });
    });

    describe("isPickManyAnswer", () => {
      it("should return true for valid pick_many answer", () => {
        expect(isPickManyAnswer({ selected: ["a", "b"] })).toBe(true);
        expect(isPickManyAnswer({ selected: [] })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isPickManyAnswer(null)).toBe(false);
        expect(isPickManyAnswer({ selected: "not-array" })).toBe(false);
        expect(isPickManyAnswer({ selected: [1, 2] })).toBe(false);
      });
    });

    describe("isConfirmAnswer", () => {
      it("should return true for valid confirm answer", () => {
        expect(isConfirmAnswer({ choice: "yes" })).toBe(true);
        expect(isConfirmAnswer({ choice: "no" })).toBe(true);
        expect(isConfirmAnswer({ choice: "cancel" })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isConfirmAnswer(null)).toBe(false);
        expect(isConfirmAnswer({ choice: "maybe" })).toBe(false);
        expect(isConfirmAnswer({})).toBe(false);
      });
    });

    describe("isAskTextAnswer", () => {
      it("should return true for valid ask_text answer", () => {
        expect(isAskTextAnswer({ text: "hello" })).toBe(true);
        expect(isAskTextAnswer({ text: "" })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isAskTextAnswer(null)).toBe(false);
        expect(isAskTextAnswer({ text: 123 })).toBe(false);
        expect(isAskTextAnswer({})).toBe(false);
      });
    });

    describe("isSliderAnswer", () => {
      it("should return true for valid slider answer", () => {
        expect(isSliderAnswer({ value: 5 })).toBe(true);
        expect(isSliderAnswer({ value: 0 })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isSliderAnswer(null)).toBe(false);
        expect(isSliderAnswer({ value: "5" })).toBe(false);
        expect(isSliderAnswer({})).toBe(false);
      });
    });

    describe("isThumbsAnswer", () => {
      it("should return true for valid thumbs answer", () => {
        expect(isThumbsAnswer({ choice: "up" })).toBe(true);
        expect(isThumbsAnswer({ choice: "down" })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isThumbsAnswer(null)).toBe(false);
        expect(isThumbsAnswer({ choice: "sideways" })).toBe(false);
      });
    });

    describe("isRankAnswer", () => {
      it("should return true for valid rank answer", () => {
        expect(isRankAnswer({ ranking: ["a", "b", "c"] })).toBe(true);
        expect(isRankAnswer({ ranking: [] })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isRankAnswer(null)).toBe(false);
        expect(isRankAnswer({ ranking: "not-array" })).toBe(false);
      });
    });

    describe("isRateAnswer", () => {
      it("should return true for valid rate answer", () => {
        expect(isRateAnswer({ ratings: { a: 5, b: 3 } })).toBe(true);
        expect(isRateAnswer({ ratings: {} })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isRateAnswer(null)).toBe(false);
        expect(isRateAnswer({ ratings: "not-object" })).toBe(false);
        expect(isRateAnswer({ ratings: { a: "five" } })).toBe(false);
      });
    });

    describe("isShowOptionsAnswer", () => {
      it("should return true for valid show_options answer", () => {
        expect(isShowOptionsAnswer({ selected: "opt1" })).toBe(true);
        expect(isShowOptionsAnswer({ selected: "opt1", feedback: "looks good" })).toBe(true);
      });

      it("should return false for invalid answers", () => {
        expect(isShowOptionsAnswer(null)).toBe(false);
        expect(isShowOptionsAnswer({ selected: 123 })).toBe(false);
      });
    });
  });
});
