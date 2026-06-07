import { parseQuestion } from "@/lib/schemas/paper";
import type { Question } from "@/lib/types";

const QUESTION_JSON_SCHEMA = `{
  "text": "full question stem",
  "topic": "syllabus topic",
  "marks": number,
  "difficulty": "easy" | "medium" | "hard",
  "type": "mcq" | "text",
  "options": ["four distinct real answer choices"],
  "correctOption": 0
}`;

export function questionJsonInstructions(type: string): string {
  return `Return a single JSON object (no markdown fences):
${QUESTION_JSON_SCHEMA}

Rules:
- Ground the question in the syllabus excerpts when provided.
- For type "mcq": include exactly 4 meaningful options — NEVER use placeholders like "Option A".
- For type "text": omit options and correctOption.
- Requested type: ${type}`;
}

export function parseQuestionFromLlm(raw: string, fallback: Question): Question | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      data = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  const merged = {
    ...fallback,
    ...(typeof data === "object" && data !== null ? data : {}),
    id: fallback.id,
  };

  const parsed = parseQuestion(merged);
  if (!parsed.success) return null;

  const q = parsed.data;
  if (q.type === "mcq") {
    const opts = q.options ?? [];
    const placeholder = opts.some((o) => /^option\s*[a-d]$/i.test(o.trim()));
    if (opts.length < 4 || placeholder) return null;
  }

  if (!q.text?.trim() || q.text.trim().length < 10) return null;

  return q;
}
