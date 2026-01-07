import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentConfig } from "@opencode-ai/sdk";
import * as v from "valibot";

import type { AGENTS } from "@/agents";

import { type OcttoConfig, OcttoConfigSchema } from "./schema";

export type { AgentOverride, OcttoConfig } from "./schema";

/**
 * Load raw user configuration from ~/.config/opencode/octto.json
 */
async function load(configDir?: string): Promise<OcttoConfig | null> {
  const baseDir = configDir ?? join(homedir(), ".config", "opencode");
  const configPath = join(baseDir, "octto.json");

  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(content);
    const result = v.safeParse(OcttoConfigSchema, parsed);

    if (!result.success) {
      return null;
    }

    return result.output;
  } catch {
    return null;
  }
}

/**
 * Load user configuration and merge with plugin agents.
 * Returns merged agent configs with user overrides applied.
 */
export async function loadCustomConfig(
  agents: Record<AGENTS, AgentConfig>,
  configDir?: string,
): Promise<Record<AGENTS, AgentConfig>> {
  const config = await load(configDir);

  if (!config?.agents) {
    return agents;
  }

  const result = { ...agents };
  for (const [name, override] of Object.entries(config.agents)) {
    result[name as AGENTS] = { ...agents[name as AGENTS], ...override };
  }

  return result;
}
