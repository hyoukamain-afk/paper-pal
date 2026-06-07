import type { StreamEvent } from "@/lib/schemas/task";
import type { Paper } from "@/lib/types";
import { computeTotalMarks } from "@/lib/schemas/paper";
import { defaultIntakeQuestions } from "@/lib/intake";
import { normalizeCopilotPaper, parseCopilotResponse } from "../copilot-response";
import { parseIntakeResponse } from "../intake-response";
import { generatedSummary, mockChatStream } from "../providers/mock-provider";
import {
  buildChatUserPrompt,
  buildCopilotPaperEditPrompt,
  buildIntakePrompt,
  buildSystemPrompt,
  COPILOT_PAPER_JSON_RULES,
  INTAKE_JSON_RULES,
} from "../prompts/registry";
import type { LlmProvider, TaskContext } from "../types";
import { runGeneratePaperTask } from "./paper";

async function* streamReplyTokens(reply: string): AsyncGenerator<StreamEvent> {
  for (const chunk of reply.split(/(\s+)/)) {
    if (chunk) yield { type: "token", content: chunk };
  }
}

export async function* runChatTask(
  ctx: TaskContext,
  provider: LlmProvider,
  useMock: boolean,
): AsyncGenerator<StreamEvent> {
  const { task, storage } = ctx;
  if (task.taskType !== "CHAT") return;

  const { message, messages, paper, turn = 0, versionHistory = [] } = task.input;
  const paperId = task.paperId ?? "default";

  let summary: string | null = null;
  if (paper && task.paperId) {
    summary = await storage.redis.getPaperSummary(task.paperId);
  }

  if (useMock) {
    const result = await mockChatStream(turn, message, !!paper);
    for await (const chunk of result.tokens.split(/(\s+)/)) {
      if (chunk) yield { type: "token", content: chunk };
    }
    if (result.intakeQuestions?.length) {
      yield { type: "intake", questions: result.intakeQuestions };
    }
    if (result.paper) {
      const synced = syncPaperMarks(
        ctx.syllabusSources.length > 0
          ? { ...result.paper, syllabusSources: ctx.syllabusSources }
          : result.paper,
      );
      yield { type: "paper", paper: synced };
      yield {
        type: "tool",
        name: "generate_paper",
        payload: { paperId },
      };
      for await (const chunk of generatedSummary.split(/(\s+)/)) {
        if (chunk) yield { type: "token", content: chunk };
      }
    }
    if (result.tool === "patch_difficulty" && paper) {
      const harder = bumpPaperDifficulty(paper);
      yield { type: "paper", paper: harder };
    }
    if (result.revertSteps) {
      yield { type: "revert", steps: result.revertSteps };
    }
    yield { type: "done", meta: { turn: turn + 1 } };
    return;
  }

  const bookLine = ctx.syllabusSources.map((s) => `${s.title} (${s.board})`).join("; ");

  if (paper) {
    const system = `${buildSystemPrompt("CHAT", ctx.ragContext, bookLine)}\n\n${COPILOT_PAPER_JSON_RULES}`;
    const user = buildCopilotPaperEditPrompt(
      message,
      paper,
      messages.map((m) => ({ role: m.role, content: m.content })),
      versionHistory,
    );

    const raw = await provider.generateText({ system, user, tier: "mid", jsonMode: true });
    const copilot = parseCopilotResponse(raw);

    yield* streamReplyTokens(copilot.reply);

    if (copilot.action === "update_paper" && copilot.paper) {
      const final = normalizeCopilotPaper(copilot.paper, ctx.syllabusSources);
      yield { type: "paper", paper: final };
      yield { type: "tool", name: "update_paper", payload: { paperId } };
    } else if (copilot.action === "revert" && copilot.revertSteps) {
      yield { type: "revert", steps: copilot.revertSteps };
    }

    yield { type: "done", meta: { turn: turn + 1 } };
    return;
  }

  // Pre-paper intake: structured MCQ follow-ups, generate only when ready
  const system = `${buildSystemPrompt("CHAT", ctx.ragContext, bookLine)}\n\n${INTAKE_JSON_RULES}`;
  const user = buildIntakePrompt(message, messages);
  const raw = await provider.generateText({ system, user, tier: "fast", jsonMode: true });
  const intake = parseIntakeResponse(raw);

  yield* streamReplyTokens(intake.reply);

  if (intake.action === "ask" && intake.questions?.length) {
    yield { type: "intake", questions: intake.questions };
    yield { type: "done", meta: { turn: turn + 1 } };
    return;
  }

  if (intake.action === "generate") {
    yield { type: "token", content: "\n\nDrafting your paper from syllabus-aligned topics…\n\n" };
    yield* runGeneratePaperTask(ctx, provider, useMock);
  } else {
    yield { type: "intake", questions: intake.questions ?? defaultIntakeQuestions() };
  }

  yield { type: "done", meta: { turn: turn + 1 } };
}

function bumpPaperDifficulty(paper: Paper): Paper {
  return {
    ...paper,
    difficulty: "hard",
    sections: paper.sections.map((sec) => ({
      ...sec,
      questions: sec.questions.map((q) => ({ ...q, difficulty: "hard" as const })),
    })),
  };
}

function syncPaperMarks(paper: Paper): Paper {
  const total = computeTotalMarks(paper);
  return { ...paper, totalMarks: total };
}
