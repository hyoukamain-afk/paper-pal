import {
  followUpReplies,
  generatedSummary,
  generatingReply,
} from "@/data/chatScripts";
import { defaultIntakeQuestions } from "@/lib/intake";
import type { IntakeQuestion } from "@/lib/intake";
import { createSamplePaper } from "@/data/samplePaper";
import { generateQuestion } from "@/data/mockGenerator";
import type { Paper, Question } from "@/lib/types";
import { parsePaper, parseQuestion } from "@/lib/schemas/paper";
import type { LlmProvider, ProviderGenerateInput } from "../types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function* streamString(text: string, chunkMs = 16): AsyncGenerator<string> {
  const tokens = text.split(/(\s+)/);
  for (const t of tokens) {
    yield t;
    await sleep(chunkMs);
  }
}

export function createMockProvider(): LlmProvider {
  return {
    name: "mock",
    async *streamText(input: ProviderGenerateInput) {
      yield* streamString(input.user.slice(0, 200) || "OK.");
    },
    async generateText(input: ProviderGenerateInput) {
      if (input.jsonMode && input.user.includes("Paper schema")) {
        return JSON.stringify(createSamplePaper());
      }
      if (input.jsonMode && input.user.includes("Question object")) {
        const q = generateQuestion({
          topic: "Electricity",
          difficulty: "medium",
          type: "text",
          marks: 3,
        });
        return JSON.stringify(q);
      }
      return "OK";
    },
  };
}

export async function mockChatStream(
  turn: number,
  message: string,
  hasPaper: boolean,
): Promise<{
  tokens: string;
  paper?: Paper;
  tool?: string;
  revertSteps?: number;
  intakeQuestions?: IntakeQuestion[];
}> {
  if (turn === 0) {
    return {
      tokens: "A few quick picks before I draft your paper:",
      intakeQuestions: defaultIntakeQuestions(),
    };
  }
  if (turn === 1) {
    return { tokens: generatingReply, paper: createSamplePaper(), tool: "generate_paper" };
  }

  const lower = message.toLowerCase();
  if (hasPaper && /\b(undo|revert|go back)\b/.test(lower)) {
    return {
      tokens: "Reverted your paper to the previous version.",
      revertSteps: 1,
    };
  }
  if (hasPaper && (lower.includes("harder") || lower.includes("difficult"))) {
    return {
      tokens: "I've increased the difficulty on section B questions. Check the preview.",
      tool: "patch_difficulty",
    };
  }
  if (hasPaper && (lower.includes("regenerate") || lower.includes("swap"))) {
    return {
      tokens: "Done — I refreshed a question in section A. Hover the ⋮ menu to tweak further.",
      tool: "regenerate_sample",
    };
  }

  const reply = followUpReplies[turn % followUpReplies.length];
  return { tokens: reply };
}

export function mockModifyQuestion(question: Question, prompt: string): Question {
  const fresh = generateQuestion({
    topic: question.topic,
    difficulty: question.difficulty,
    type: question.type,
    marks: question.marks,
  });
  const note = prompt.trim() ? ` (${prompt.trim()})` : "";
  return { ...fresh, id: question.id, text: fresh.text + note };
}

export function mockParsePaperJson(raw: string): Paper | null {
  try {
    const data = JSON.parse(raw);
    const r = parsePaper(data);
    return r.success ? r.data : createSamplePaper();
  } catch {
    return createSamplePaper();
  }
}

export function mockParseQuestionJson(raw: string, fallback: Question): Question {
  try {
    const data = JSON.parse(raw);
    const r = parseQuestion(data);
    return r.success ? r.data : fallback;
  } catch {
    return fallback;
  }
}

export { generatedSummary, generatingReply };
