import type { LlmTask, StreamEvent } from "@/lib/schemas/task";
import type { Paper, Question, SyllabusSource } from "@/lib/types";
import type { StorageContext, TraceLog } from "@/server/storage/types";

export type ModelTier = "fast" | "mid" | "strong";

export type ModelConfig = {
  provider: "mock" | "anthropic";
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
};

export type TaskContext = {
  storage: StorageContext;
  task: LlmTask;
  ragContext: string;
  retrievalIds: string[];
  syllabusSources: SyllabusSource[];
};

export type TaskRunResult = {
  events: StreamEvent[];
  paper?: Paper;
  question?: Question;
  jobId?: string;
  trace: TraceLog;
};

export type ProviderGenerateInput = {
  system: string;
  user: string;
  tier: ModelTier;
  jsonMode?: boolean;
};

export interface LlmProvider {
  name: string;
  streamText(input: ProviderGenerateInput): AsyncGenerator<string>;
  generateText(input: ProviderGenerateInput): Promise<string>;
}

export type OrchestratorEnv = {
  useMock?: boolean;
  cfEnv?: import("@/server/env").CfEnv;
};
