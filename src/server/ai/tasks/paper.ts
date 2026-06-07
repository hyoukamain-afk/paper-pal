import type { StreamEvent } from "@/lib/schemas/task";
import { computeTotalMarks } from "@/lib/schemas/paper";
import { createSamplePaper } from "@/data/samplePaper";
import { parsePaperFromLlm, paperJsonInstructions } from "../parse-paper-json";
import { buildGeneratePaperPrompt, buildSystemPrompt } from "../prompts/registry";
import type { LlmProvider, TaskContext } from "../types";

function conversationText(
  task: import("@/lib/schemas/task").LlmTask,
): { requirements: string; messages: string } {
  if (task.taskType === "GENERATE_PAPER") {
    return {
      requirements: task.input.requirements ?? "",
      messages: (task.input.messages ?? []).map((m) => `${m.role}: ${m.content}`).join("\n"),
    };
  }
  if (task.taskType === "CHAT") {
    const lines = task.input.messages.map((m) => `${m.role}: ${m.content}`);
    return {
      requirements: lines.join("\n"),
      messages: lines.join("\n"),
    };
  }
  return { requirements: "", messages: "" };
}

export async function* runGeneratePaperTask(
  ctx: TaskContext,
  provider: LlmProvider,
  useMock: boolean,
): AsyncGenerator<StreamEvent> {
  const task = ctx.task;
  const { requirements, messages } = conversationText(task);

  const withSources = (p: import("@/lib/types").Paper) =>
    ctx.syllabusSources.length > 0 ? { ...p, syllabusSources: ctx.syllabusSources } : p;

  if (useMock) {
    await new Promise((r) => setTimeout(r, 400));
    const paper = withSources(createSamplePaper());
    const synced = { ...paper, totalMarks: computeTotalMarks(paper) };
    yield { type: "paper", paper: synced };
    yield { type: "done", meta: { source: "mock" } };
    return;
  }

  const bookLine = ctx.syllabusSources.map((s) => `${s.title} (${s.board})`).join("; ");
  const system = `${buildSystemPrompt("GENERATE_PAPER", ctx.ragContext, bookLine)}\n\n${paperJsonInstructions()}`;
  const user = buildGeneratePaperPrompt(requirements, messages);

  let raw = await provider.generateText({
    system,
    user,
    tier: "strong",
    jsonMode: true,
  });

  let parsed = parsePaperFromLlm(raw);

  if (!parsed) {
    raw = await provider.generateText({
      system: `${system}\n\nFix the JSON to pass schema validation. Return ONLY the corrected Paper JSON.`,
      user: `The previous output was invalid or incomplete. Conversation requirements:\n${messages}\n\nInvalid output to fix:\n${raw.slice(0, 14000)}`,
      tier: "strong",
      jsonMode: true,
    });
    parsed = parsePaperFromLlm(raw);
  }

  if (!parsed) {
    yield {
      type: "error",
      message: "Could not generate a valid paper. Try simplifying (fewer questions) and retry.",
      retryable: true,
    };
    return;
  }

  const final = withSources({ ...parsed, totalMarks: computeTotalMarks(parsed) });
  yield { type: "paper", paper: final };
  yield { type: "done" };
}
