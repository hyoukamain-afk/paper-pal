import type { LlmTask, StreamEvent } from "@/lib/schemas/task";
import { llmTaskSchema } from "@/lib/schemas/task";
import { getStorage } from "@/server/storage";
import type { StorageContext, TraceLog } from "@/server/storage/types";
import { selectSyllabusBooks } from "./rag/book-selector";
import { seedDefaultSyllabus } from "./rag/ingest";
import { parsePaperIntent } from "./rag/intent";
import { retrieve } from "./rag/retriever";
import { resolveAiSecrets } from "@/server/env";
import { createAnthropicProvider } from "./providers/anthropic-provider";
import { createMockProvider } from "./providers/mock-provider";
import { runChatTask } from "./tasks/chat";
import { runGeneratePaperTask } from "./tasks/paper";
import { runGenerateQuestionTask, runModifyQuestionTask } from "./tasks/question";
import type { LlmProvider, OrchestratorEnv } from "./types";

let seeded = false;

async function ensureSeeded(storage: StorageContext): Promise<void> {
  if (seeded) return;
  await seedDefaultSyllabus(storage);
  seeded = true;
}

function getProvider(env: OrchestratorEnv): LlmProvider {
  const { anthropicApiKey } = resolveAiSecrets(env.cfEnv);
  if (env.useMock !== false && !anthropicApiKey) return createMockProvider();
  if (!anthropicApiKey) return createMockProvider();
  return createAnthropicProvider(anthropicApiKey);
}

function paperSummary(paper: import("@/lib/types").Paper | null | undefined): string {
  if (!paper) return "";
  const qCount = paper.sections.reduce((n, s) => n + s.questions.length, 0);
  return `${paper.title}; Class ${paper.className} ${paper.subject}; ${qCount} questions; ${paper.totalMarks} marks; topics: ${paper.topics.join(", ")}`;
}

async function* executeTask(
  storage: StorageContext,
  task: LlmTask,
  env: OrchestratorEnv,
): AsyncGenerator<StreamEvent> {
  await ensureSeeded(storage);

  const useMock = env.useMock !== false && !resolveAiSecrets(env.cfEnv).anthropicApiKey;
  const provider = getProvider(env);
  const start = Date.now();

  const paper =
    task.taskType === "CHAT"
      ? task.input.paper
      : task.taskType === "GENERATE_QUESTION" || task.taskType === "MODIFY_QUESTION"
        ? task.input.paper
        : task.taskType === "GENERATE_PAPER"
          ? (task.input.paper ?? null)
          : null;

  const intent = parsePaperIntent(task, paper);
  const selection = await selectSyllabusBooks(storage, intent);

  const retrieval = await retrieve(
    storage,
    {
      text:
        task.taskType === "CHAT"
          ? task.input.message
          : task.taskType === "MODIFY_QUESTION"
            ? task.input.prompt
            : task.taskType === "GENERATE_QUESTION"
              ? (task.input.topic ?? "")
              : (task.input.requirements ?? intent.queryText),
      paper,
      topic:
        task.taskType === "GENERATE_QUESTION"
          ? task.input.topic
          : task.taskType === "MODIFY_QUESTION"
            ? task.input.question.topic
            : undefined,
      documentIds: selection.documentIds,
      chapters: selection.chapters,
    },
    env.cfEnv,
  );

  const ctx = {
    storage,
    task,
    ragContext: retrieval.contextBlock,
    retrievalIds: retrieval.chunks.map((c) => c.id),
    syllabusSources: selection.sources,
  };

  if (task.paperId) {
    const locked = await storage.redis.acquireLock(`paper:${task.paperId}`, 120);
    if (!locked) {
      yield {
        type: "error",
        message: "Another edit is in progress on this paper. Try again in a moment.",
        retryable: true,
      };
      return;
    }
  }

  try {
    switch (task.taskType) {
      case "CHAT":
        yield* runChatTask(ctx, provider, useMock);
        break;
      case "GENERATE_PAPER":
        yield* runGeneratePaperTask(ctx, provider, useMock);
        break;
      case "GENERATE_QUESTION":
        yield* runGenerateQuestionTask(ctx, provider, useMock);
        break;
      case "MODIFY_QUESTION":
        yield* runModifyQuestionTask(ctx, provider, useMock);
        break;
      default:
        yield { type: "error", message: "Unknown task type", retryable: false };
    }

    if (paper && task.paperId) {
      await storage.redis.setPaperSummary(task.paperId, paperSummary(paper), 3600);
    }
  } finally {
    if (task.paperId) await storage.redis.releaseLock(`paper:${task.paperId}`);
  }

  void ({
    taskType: task.taskType,
    trigger: task.trigger,
    latencyMs: Date.now() - start,
    retrievalIds: retrieval.chunks.map((c) => c.id),
    cached: false,
  } satisfies TraceLog);
}

export async function* runTask(
  taskInput: unknown,
  env: OrchestratorEnv = {},
  storageCtx?: StorageContext,
): AsyncGenerator<StreamEvent> {
  const parsed = llmTaskSchema.safeParse(taskInput);
  if (!parsed.success) {
    yield {
      type: "error",
      message: parsed.error.message,
      retryable: false,
    };
    return;
  }

  const task = parsed.data;
  const storage = storageCtx ?? getStorage();

  const allowed = await storage.redis.checkRateLimit(task.userId ?? task.sessionId, 60, 3600);
  if (!allowed) {
    yield { type: "error", message: "Rate limit exceeded. Try again later.", retryable: true };
    return;
  }

  const cached = await storage.redis.getIdempotentResult(task.idempotencyKey);
  if (cached) {
    for (const ev of cached) yield ev;
    return;
  }

  const events: StreamEvent[] = [];
  for await (const event of executeTask(storage, task, env)) {
    events.push(event);
    yield event;
  }

  let lastDone = -1;
  events.forEach((e, i) => {
    if (e.type === "done") lastDone = i;
  });
  const forCache = events.filter((e, i) => e.type !== "done" || i === lastDone);
  await storage.redis.setIdempotentResult(task.idempotencyKey, forCache, 300);

  const jobId = `job_${Date.now().toString(36)}`;
  await storage.postgres.createJob({
    id: jobId,
    taskType: task.taskType,
    status: "completed",
    inputHash: task.idempotencyKey,
    outputJson: events.filter((e) => e.type === "paper" || e.type === "question"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (task.paperId && task.taskType === "CHAT") {
    const paperEvent = events.find((e) => e.type === "paper");
    if (paperEvent?.type === "paper") {
      await storage.postgres.savePaper({
        id: task.paperId,
        sessionId: task.sessionId,
        userId: task.userId,
        version: Date.now(),
        data: paperEvent.paper,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function runTaskCollect(
  taskInput: unknown,
  env?: OrchestratorEnv,
  storageCtx?: StorageContext,
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const e of runTask(taskInput, env, storageCtx)) events.push(e);
  return events;
}

export function getOrchestratorEnv(cfEnv?: import("@/server/env").CfEnv): OrchestratorEnv {
  const { anthropicApiKey } = resolveAiSecrets(cfEnv);
  return { useMock: !anthropicApiKey, cfEnv };
}
