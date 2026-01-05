// src/tools/brainstorm/index.ts
import { tool } from "@opencode-ai/plugin/tool";
import type { OpencodeClient } from "@opencode-ai/sdk";
import type { SessionManager } from "../../session/manager";
import { BrainstormOrchestrator } from "./orchestrator";
import { BrainstormError } from "./types";

export { BrainstormOrchestrator } from "./orchestrator";
export * from "./types";
export * from "./probe";
export * from "./summarize";

export function createBrainstormTool(sessionManager: SessionManager, client: OpencodeClient) {
  return tool({
    description: `Run an interactive brainstorming session with the user.

Opens a browser window with questions, collects answers, generates follow-up questions
using an internal LLM, and returns a synthesized design document.

This is a BLOCKING tool - it runs until the brainstorming session is complete.

The calling agent should:
1. Gather context about the user's request
2. Generate 2-3 initial questions
3. Call this tool with context, request, and initial questions
4. Receive back all answers and a design summary`,
    args: {
      context: tool.schema.string().describe("Background context gathered by the calling agent"),
      request: tool.schema.string().describe("User's original request"),
      initial_questions: tool.schema
        .array(
          tool.schema.object({
            type: tool.schema
              .enum([
                "pick_one",
                "pick_many",
                "confirm",
                "ask_text",
                "show_options",
                "thumbs",
                "slider",
                "rank",
                "rate",
              ])
              .describe("Question type"),
            config: tool.schema.object({}).passthrough().describe("Question config (varies by type)"),
          }),
        )
        .describe("Initial questions to display (2-3 recommended)"),
      max_questions: tool.schema
        .number()
        .optional()
        .describe("Maximum total questions including follow-ups (default: 15)"),
      model: tool.schema
        .string()
        .optional()
        .describe("Model for internal LLM calls (default: anthropic/claude-sonnet-4)"),
    },
    execute: async (args, ctx) => {
      // Validate initial questions
      if (!args.initial_questions || args.initial_questions.length === 0) {
        return `## ERROR: initial_questions is required

The brainstorm tool needs at least one initial question to start the session.

Example:
\`\`\`
brainstorm(
  context="User wants to add caching to their Express API",
  request="Add caching to my API",
  initial_questions=[
    {type: "pick_one", config: {question: "What's the primary goal?", options: [{id: "speed", label: "Speed"}, {id: "cost", label: "Cost reduction"}]}},
    {type: "ask_text", config: {question: "Any constraints?", placeholder: "e.g., must use Redis..."}}
  ]
)
\`\`\``;
      }

      try {
        const orchestrator = new BrainstormOrchestrator(sessionManager, client, ctx.sessionID);

        const result = await orchestrator.run({
          context: args.context,
          request: args.request,
          initial_questions: args.initial_questions.map((q) => ({
            type: q.type as import("../../session/types").QuestionType,
            config: q.config as unknown as import("../../session/types").QuestionConfig,
          })),
          max_questions: args.max_questions,
          model: args.model,
        });

        // Format output
        let output = `## Brainstorming Complete

### Answers Collected (${result.answers.length})

`;

        for (let i = 0; i < result.answers.length; i++) {
          const a = result.answers[i];
          output += `**Q${i + 1}** [${a.type}]: ${a.question}\n`;
          output += `**A${i + 1}**: \`\`\`json\n${JSON.stringify(a.answer, null, 2)}\n\`\`\`\n\n`;
        }

        output += `---

### Design Summary

${result.summary}`;

        return output;
      } catch (e) {
        if (e instanceof BrainstormError) {
          return `## Brainstorming Error

**Type:** ${e.type}
**Message:** ${e.message}

${e.type === "session_closed" ? "The user closed the browser window before completing the session." : ""}
${e.type === "timeout" ? "The session timed out waiting for user input." : ""}
${e.type === "llm_error" ? "There was an error communicating with the LLM." : ""}`;
        }

        return `## Brainstorming Error

**Message:** ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });
}
