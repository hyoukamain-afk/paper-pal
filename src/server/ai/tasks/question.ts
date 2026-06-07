import type { StreamEvent } from "@/lib/schemas/task";
import { generateQuestion } from "@/data/mockGenerator";
import type { Question } from "@/lib/types";
import { parseQuestionFromLlm, questionJsonInstructions } from "../parse-question-json";
import {
  buildGenerateQuestionPrompt,
  buildModifyQuestionPrompt,
  buildSystemPrompt,
} from "../prompts/registry";
import { mockModifyQuestion } from "../providers/mock-provider";
import type { LlmProvider, TaskContext } from "../types";

export async function* runGenerateQuestionTask(
  ctx: TaskContext,
  provider: LlmProvider,
  useMock: boolean,
): AsyncGenerator<StreamEvent> {
  const task = ctx.task;
  if (task.taskType !== "GENERATE_QUESTION") return;

  const { paper, sectionId, questionId, topic, difficulty, type, marks } = task.input;
  const sec = paper.sections.find((s) => s.id === sectionId);
  const ref =
    sec?.questions.find((q) => q.id === questionId) ?? sec?.questions[sec.questions.length - 1];

  const t = topic ?? ref?.topic ?? paper.topics[0] ?? "General";
  const d = difficulty ?? ref?.difficulty ?? paper.difficulty;
  const ty = type ?? ref?.type ?? "text";
  const m = marks ?? ref?.marks ?? 3;
  const fallback: Question = ref ?? {
    id: `q_${Date.now().toString(36)}`,
    text: "",
    topic: t,
    marks: m,
    difficulty: d,
    type: ty,
  };

  if (useMock) {
    const q = generateQuestion({ topic: t, difficulty: d, type: ty, marks: m });
    if (ref?.id) yield { type: "question", question: { ...q, id: ref.id } };
    else yield { type: "question", question: q };
    yield { type: "done" };
    return;
  }

  const system = `${buildSystemPrompt("GENERATE_QUESTION", ctx.ragContext)}\n\n${questionJsonInstructions(ty)}`;
  const user = buildGenerateQuestionPrompt(paper, t, d, ty, m, sec?.title);
  const raw = await provider.generateText({ system, user, tier: "mid", jsonMode: true });

  let question = parseQuestionFromLlm(raw, { ...fallback, topic: t, marks: m, difficulty: d, type: ty });
  if (!question) {
    yield {
      type: "error",
      message: "Could not parse a valid question from AI. Try again.",
      retryable: true,
    };
    return;
  }
  if (ref?.id) question = { ...question, id: ref.id };

  yield { type: "question", question };
  yield { type: "done" };
}

export async function* runModifyQuestionTask(
  ctx: TaskContext,
  provider: LlmProvider,
  useMock: boolean,
): AsyncGenerator<StreamEvent> {
  const task = ctx.task;
  if (task.taskType !== "MODIFY_QUESTION") return;

  const { question, prompt, paper } = task.input;

  if (useMock) {
    const ack = `Updated — applied: "${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}"`;
    for (const chunk of ack.split(/(\s+)/)) {
      if (chunk) yield { type: "token", content: chunk };
    }
    const updated = mockModifyQuestion(question, prompt);
    yield { type: "question", question: updated };
    yield { type: "done" };
    return;
  }

  const system = `${buildSystemPrompt("MODIFY_QUESTION", ctx.ragContext)}\n\n${questionJsonInstructions(question.type)}`;
  const user = buildModifyQuestionPrompt(question, prompt, paper);
  const raw = await provider.generateText({
    system,
    user,
    tier: "mid",
    jsonMode: true,
  });

  const updated = parseQuestionFromLlm(raw, question);
  if (!updated) {
    yield {
      type: "error",
      message: "Could not apply your edit. Try rephrasing the instruction.",
      retryable: true,
    };
    return;
  }

  yield {
    type: "question",
    question: { ...updated, id: question.id },
  };
  yield { type: "done" };
}
