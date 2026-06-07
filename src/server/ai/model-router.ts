import type { LlmTask } from "@/lib/schemas/task";
import type { ModelConfig, ModelTier } from "./types";

const BUDGETS: Record<LlmTask["taskType"], { tier: ModelTier; maxIn: number; maxOut: number }> = {
  CHAT: { tier: "fast", maxIn: 8000, maxOut: 2000 },
  GENERATE_PAPER: { tier: "strong", maxIn: 12000, maxOut: 8192 },
  GENERATE_QUESTION: { tier: "mid", maxIn: 4000, maxOut: 1500 },
  MODIFY_QUESTION: { tier: "mid", maxIn: 4000, maxOut: 1200 },
  CLASSIFY_INTENT: { tier: "fast", maxIn: 2000, maxOut: 200 },
};

/** Claude Haiku 4.5 for all generation tiers (user preference). */
export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";

const TIER_MAX_OUTPUT: Record<ModelTier, number> = {
  fast: 2000,
  mid: 4000,
  strong: 8192,
};

export function routeModel(task: LlmTask, useMock: boolean): ModelConfig {
  const budget = BUDGETS[task.taskType];
  if (useMock) {
    return {
      provider: "mock",
      model: `mock-${budget.tier}`,
      maxInputTokens: budget.maxIn,
      maxOutputTokens: budget.maxOut,
    };
  }
  return {
    provider: "anthropic",
    model: CLAUDE_HAIKU_MODEL,
    maxInputTokens: budget.maxIn,
    maxOutputTokens: TIER_MAX_OUTPUT[budget.tier],
  };
}

export function modelForTier(tier: ModelTier, useMock: boolean): ModelConfig {
  if (useMock) {
    return {
      provider: "mock",
      model: `mock-${tier}`,
      maxInputTokens: 8000,
      maxOutputTokens: TIER_MAX_OUTPUT[tier],
    };
  }
  return {
    provider: "anthropic",
    model: CLAUDE_HAIKU_MODEL,
    maxInputTokens: 12000,
    maxOutputTokens: TIER_MAX_OUTPUT[tier],
  };
}
