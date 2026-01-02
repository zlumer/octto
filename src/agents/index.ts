// src/agents/index.ts
import type { AgentConfig } from "@opencode-ai/sdk";
import { brainstormerAgent } from "./brainstormer";

export const agents: Record<string, AgentConfig> = {
  brainstormer: brainstormerAgent,
};

export { brainstormerAgent };
