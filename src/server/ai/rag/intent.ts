import type { LlmTask } from "@/lib/schemas/task";
import type { Paper } from "@/lib/types";

export type PaperIntent = {
  board: string;
  className: string;
  subject: string;
  topics: string[];
  queryText: string;
};

const BOARD_DEFAULT = "CBSE";

function extractClass(text: string): string | null {
  const m = text.match(/\bclass\s*(\d{1,2})\b/i) ?? text.match(/\b(\d{1,2})(?:th|st|nd|rd)?\s*class\b/i);
  return m?.[1] ?? null;
}

function extractSubject(text: string): string | null {
  const subjects = [
    "Political Science",
    "Social Science",
    "Economics",
    "Physics",
    "Chemistry",
    "Mathematics",
    "Maths",
    "Biology",
    "Science",
    "English",
    "History",
    "Geography",
  ];
  const lower = text.toLowerCase();
  for (const s of subjects) {
    if (lower.includes(s.toLowerCase())) return s === "Maths" ? "Mathematics" : s;
  }
  return null;
}

function extractTopics(text: string, paper?: Paper | null): string[] {
  const fromPaper = paper?.topics ?? [];
  const quoted = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  const afterFor = text.match(/\b(?:on|about|covering)\s+([a-z0-9\s,&-]{3,40})/i)?.[1];
  const topicList = afterFor
    ? afterFor.split(/,| and /).map((t) => t.trim()).filter(Boolean)
    : [];
  return [...new Set([...fromPaper, ...quoted, ...topicList])].slice(0, 8);
}

export function parsePaperIntent(task: LlmTask, paper?: Paper | null): PaperIntent {
  let text = "";
  if (task.taskType === "CHAT") text = task.input.message;
  else if (task.taskType === "GENERATE_PAPER") {
    text = task.input.requirements ?? "";
  } else if (task.taskType === "GENERATE_QUESTION") {
    text = task.input.topic ?? "";
  } else if (task.taskType === "MODIFY_QUESTION") {
    text = task.input.prompt;
  }

  const className =
    paper?.className?.replace(/\D/g, "") ||
    task.taskType === "GENERATE_PAPER"
      ? (task.input.className?.replace(/\D/g, "") ?? extractClass(text))
      : extractClass(text) ||
        "10";

  const subject =
    paper?.subject ||
    (task.taskType === "GENERATE_PAPER" ? task.input.subject : null) ||
    extractSubject(text) ||
    "Social Science";

  const topics = extractTopics(text, paper);

  return {
    board: BOARD_DEFAULT,
    className,
    subject,
    topics,
    queryText: [text, subject, ...topics].filter(Boolean).join(" "),
  };
}
