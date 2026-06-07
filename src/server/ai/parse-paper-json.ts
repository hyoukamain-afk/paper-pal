import { parsePaper } from "@/lib/schemas/paper";
import type { Paper, Question } from "@/lib/types";

const nid = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(n++).toString(36)}`;
})();

function isPlaceholderMcq(q: Question): boolean {
  if (q.type !== "mcq") return false;
  const opts = q.options ?? [];
  return opts.length < 4 || opts.some((o) => /^option\s*[a-d]$/i.test(o.trim()));
}

function isValidQuestion(q: Question): boolean {
  if (!q.text?.trim() || q.text.trim().length < 10) return false;
  if (isPlaceholderMcq(q)) return false;
  return true;
}

function coerceQuestion(q: unknown): unknown {
  if (typeof q !== "object" || q === null) return q;
  const d = q as Record<string, unknown>;
  const diff = String(d.difficulty ?? "medium").toLowerCase();
  return {
    ...d,
    text: String(d.text ?? ""),
    topic: String(d.topic ?? "General"),
    type: String(d.type ?? "text").toLowerCase() === "mcq" ? "mcq" : "text",
    difficulty: diff === "easy" || diff === "hard" ? diff : "medium",
    marks:
      typeof d.marks === "number"
        ? Math.max(1, Math.floor(d.marks))
        : Math.max(1, parseInt(String(d.marks), 10) || 1),
  };
}

function coerceSection(sec: unknown, index: number): unknown {
  if (typeof sec !== "object" || sec === null) return sec;
  const s = sec as Record<string, unknown>;
  const questions = Array.isArray(s.questions) ? s.questions.map(coerceQuestion) : [];
  return {
    ...s,
    id: s.id ?? `sec_${index}`,
    title: s.title ?? `Section ${String.fromCharCode(65 + index)}`,
    instruction: s.instruction ?? "Answer the following questions.",
    questions,
  };
}

function coercePaperShape(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  const d = data as Record<string, unknown>;
  const sections = Array.isArray(d.sections) ? d.sections.map(coerceSection) : [];
  const diff = String(d.difficulty ?? "medium").toLowerCase();
  return {
    title: d.title ?? "Examination Paper",
    className: d.className ?? d.class ?? "Class 10",
    subject: d.subject ?? "General",
    topics: Array.isArray(d.topics) ? d.topics : [],
    totalMarks: typeof d.totalMarks === "number" ? d.totalMarks : 80,
    durationMinutes: typeof d.durationMinutes === "number" ? d.durationMinutes : 90,
    difficulty: diff === "easy" || diff === "hard" ? diff : "medium",
    sections,
    topicWeights: d.topicWeights,
    syllabusSources: d.syllabusSources,
  };
}

function assignIds(paper: Paper): Paper {
  return {
    ...paper,
    sections: paper.sections.map((sec, si) => ({
      ...sec,
      id: sec.id?.trim() ? sec.id : nid(`sec_${si}`),
      questions: sec.questions.map((q, qi) => ({
        ...q,
        id: q.id?.trim() ? q.id : nid(`q_${si}_${qi}`),
      })),
    })),
  };
}

function cleanPaper(paper: Paper): Paper | null {
  const sections = paper.sections
    .map((sec) => ({
      ...sec,
      questions: sec.questions.filter(isValidQuestion),
    }))
    .filter((sec) => sec.questions.length > 0);

  if (sections.length === 0) return null;
  return { ...paper, sections };
}

function extractJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function parsePaperFromLlm(raw: string): Paper | null {
  const data = extractJson(raw);
  if (!data) return null;

  const parsed = parsePaper(coercePaperShape(data));
  if (!parsed.success) return null;

  const withIds = assignIds(parsed.data);
  return cleanPaper(withIds);
}

export const PAPER_JSON_SCHEMA = `{
  "title": "string",
  "className": "Class 10",
  "subject": "Social Science",
  "topics": ["topic1", "topic2"],
  "totalMarks": 100,
  "durationMinutes": 180,
  "difficulty": "medium",
  "sections": [
    {
      "id": "sec_a",
      "title": "Section A",
      "instruction": "Choose the correct option. Each question carries 1 mark.",
      "questions": [
        {
          "id": "q_a1",
          "type": "mcq",
          "text": "Full question stem here",
          "topic": "History",
          "marks": 1,
          "difficulty": "easy",
          "options": ["Real option 1", "Real option 2", "Real option 3", "Real option 4"],
          "correctOption": 0
        }
      ]
    }
  ]
}`;

export function paperJsonInstructions(): string {
  return `Return a single Paper JSON object (no markdown fences):
${PAPER_JSON_SCHEMA}

Rules:
- Include ALL sections and questions the teacher requested.
- Every question needs a unique "id", real "text" (≥10 chars), correct "marks", and syllabus-aligned content.
- MCQ: exactly 4 real options — never "Option A" placeholders. Include "correctOption" (0–3).
- Text questions: omit "options" and "correctOption".
- "totalMarks" must equal the sum of all question marks.`;
}
