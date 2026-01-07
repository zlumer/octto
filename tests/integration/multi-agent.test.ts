// tests/integration/multi-agent.test.ts
import { describe, expect, it } from "bun:test";

describe("Multi-Agent Integration", () => {
  describe("Bootstrapper JSON parsing", () => {
    it("should parse valid bootstrapper response", () => {
      const bootstrapperResponse = `[
        {
          "type": "pick_one",
          "config": {
            "question": "What's the primary goal?",
            "options": [
              {"id": "speed", "label": "Fast performance"},
              {"id": "simple", "label": "Simplicity"}
            ]
          }
        },
        {
          "type": "ask_text",
          "config": {
            "question": "Any constraints?",
            "placeholder": "e.g., must work offline..."
          }
        }
      ]`;

      const questions = JSON.parse(bootstrapperResponse);

      expect(questions).toHaveLength(2);
      expect(questions[0].type).toBe("pick_one");
      expect(questions[0].config.question).toBe("What's the primary goal?");
      expect(questions[1].type).toBe("ask_text");
    });

    it("should handle bootstrapper response with extra whitespace", () => {
      const bootstrapperResponse = `
      
      [{"type": "confirm", "config": {"question": "Ready?"}}]
      
      `;

      const questions = JSON.parse(bootstrapperResponse.trim());

      expect(questions).toHaveLength(1);
      expect(questions[0].type).toBe("confirm");
    });
  });

  describe("Probe JSON parsing", () => {
    it("should parse probe response with question", () => {
      const probeResponse = `{
        "done": false,
        "reason": "Need to understand scale requirements",
        "question": {
          "type": "slider",
          "config": {
            "question": "Expected number of users?",
            "min": 1,
            "max": 1000000,
            "defaultValue": 1000
          }
        }
      }`;

      const result = JSON.parse(probeResponse);

      expect(result.done).toBe(false);
      expect(result.reason).toBe("Need to understand scale requirements");
      expect(result.question.type).toBe("slider");
      expect(result.question.config.min).toBe(1);
    });

    it("should parse probe done response", () => {
      const probeResponse = `{
        "done": true,
        "reason": "All key decisions have been made"
      }`;

      const result = JSON.parse(probeResponse);

      expect(result.done).toBe(true);
      expect(result.reason).toBe("All key decisions have been made");
      expect(result.question).toBeUndefined();
    });
  });
});
