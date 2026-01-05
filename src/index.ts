// src/index.ts
import type { Plugin } from "@opencode-ai/plugin";
import type { ToolContext } from "@opencode-ai/plugin/tool";
import { SessionManager } from "./session/manager";
import { createBrainstormerTools } from "./tools";
import { agents } from "./agents";

// Keywords that trigger brainstormer agent
const BRAINSTORM_KEYWORDS = [
  "brainstorm",
  "help me design",
  "help me think",
  "let's design",
  "design a",
  "improvements to",
  "improve the",
  "refine this idea",
  "flesh out",
  "think through",
  "architect",
  "what should",
  "how should i build",
  "help me plan",
];

function shouldTriggerBrainstormer(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BRAINSTORM_KEYWORDS.some((keyword) => lowerText.includes(keyword));
}

const BrainstormerPlugin: Plugin = async (ctx) => {
  // Create session manager
  const sessionManager = new SessionManager();

  // Track which brainstormer sessions belong to which OpenCode sessions
  const sessionsByOpenCodeSession = new Map<string, Set<string>>();

  // Create all tools with session tracking (pass client for brainstorm tool)
  const baseTools = createBrainstormerTools(sessionManager, ctx.client);

  // Wrap start_session to track ownership, but use original execute for enforcement
  const originalStartSession = baseTools.start_session;
  const wrappedStartSession = {
    ...originalStartSession,
    execute: async (args: Record<string, unknown>, toolCtx: ToolContext) => {
      // Call original execute (which has enforcement)
      // Cast args to match original execute signature - validated by zod schema at runtime
      type StartSessionArgs = Parameters<typeof originalStartSession.execute>[0];
      const result = await originalStartSession.execute(args as StartSessionArgs, toolCtx);

      // If successful, track the session
      const sessionIdMatch = result.match(/ses_[a-z0-9]+/);
      if (sessionIdMatch) {
        const openCodeSessionId = toolCtx.sessionID;
        if (openCodeSessionId) {
          if (!sessionsByOpenCodeSession.has(openCodeSessionId)) {
            sessionsByOpenCodeSession.set(openCodeSessionId, new Set());
          }
          sessionsByOpenCodeSession.get(openCodeSessionId)!.add(sessionIdMatch[0]);
        }
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
      // Add brainstormer agent (kept for backward compatibility)
      config.agent = {
        ...config.agent,
        ...agents,
      };
    },

    event: async ({ event }) => {
      // Cleanup sessions when OpenCode session is deleted
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

    "chat.message": async (_input, output) => {
      // Check if any text part contains brainstorming keywords
      const hasBrainstormKeyword = output.parts.some((p) => {
        if (p.type === "text" && "text" in p) {
          return shouldTriggerBrainstormer((p as { text: string }).text);
        }
        return false;
      });

      if (hasBrainstormKeyword) {
        // Inject an agent part to trigger the brainstormer
        output.parts.push({
          type: "agent",
          name: "brainstormer",
        } as unknown as (typeof output.parts)[number]);
      }
    },
  };
};

export default BrainstormerPlugin;

// Re-export types for consumers
export type * from "./types";
export type * from "./tools/brainstorm/types";
