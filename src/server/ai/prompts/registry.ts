import type { LlmTask } from "@/lib/schemas/task";
import type { Paper, Question, VersionHistoryEntry } from "@/lib/types";
import { formatPaperOutline } from "@/lib/paper-outline";

const BASE_SYSTEM = `You are Paperly, an expert exam-paper assistant for Indian school teachers (CBSE/ICSE style).
Ground questions in the provided syllabus excerpts when present.
Output valid JSON when asked for structured data.`;

export const COPILOT_PAPER_JSON_RULES = `When a paper already exists, you MUST respond with a single JSON object (no markdown fences):
{
  "reply": "conversational message to the teacher",
  "action": "none" | "update_paper" | "revert",
  "paper": <full Paper object or omit/null when action is not update_paper>,
  "revertSteps": <positive integer, only when action is revert>
}

Rules:
- action "update_paper": teacher wants ANY change to the paper (edit question text, swap/reorder questions, change marks, difficulty, sections, add/remove questions, rename title, etc.). Return the COMPLETE updated Paper JSON in "paper". Preserve question "id" fields when editing existing questions; only generate new ids for newly added questions.
- action "revert": teacher asks to undo/revert/go back. Set revertSteps (1 = undo last change, 2 = two changes ago, etc.).
- action "none": general chat, clarifying questions, or advice with no paper mutation.
- Teachers refer to questions as "Q2", "Section A question 2", etc. — use the numbered outline and ids.
- Keep syllabus-aligned content when excerpts are provided.`;

export function buildSystemPrompt(
  taskType: LlmTask["taskType"],
  ragContext: string,
  syllabusBooks?: string,
): string {
  return `${BASE_SYSTEM}

Task: ${taskType}

Selected syllabus books:
${syllabusBooks || "(agent will match class/subject from catalog)"}

Syllabus excerpts:
${ragContext || "(none)"}`;
}

export const INTAKE_JSON_RULES = `When no paper exists yet, respond with a single JSON object (no markdown fences):
{
  "reply": "one short friendly line",
  "action": "ask" | "generate",
  "questions": [
    {
      "id": "unique_id",
      "prompt": "short label shown above options",
      "options": [{ "id": "a", "label": "visible option text" }],
      "allowMultiple": false
    }
  ]
}

Rules:
- action "ask": the teacher has not given enough detail to draft. Include 1–4 objective MCQ-style questions with concrete clickable options. Do NOT ask open-ended numbered lists in "reply".
- action "generate": you have class, subject/topics, total marks, section structure, and question types. Set "questions" to [] or omit it.
- Infer what is already clear from the conversation; only ask for missing details.
- Each question needs 2–6 short option labels (e.g. "Class 10", "90 marks", "Mixed").
- Set "allowMultiple": true when the teacher may pick more than one option (e.g. question types).
- Ask all missing details in ONE "questions" array — do not split across multiple turns unless something is still unclear after the teacher submits.`;

export function buildIntakePrompt(
  message: string,
  messages: Array<{ role: string; content: string }>,
): string {
  const convo =
    messages.length > 0
      ? messages.map((m) => `${m.role}: ${m.content}`).join("\n")
      : "(start of conversation)";
  return `Conversation so far:
${convo}

Latest teacher message:
${message}

Decide whether to ask more (action "ask") or generate the paper (action "generate").`;
}

export function buildChatUserPrompt(
  message: string,
  paper: Paper | null,
  paperSummary?: string | null,
): string {
  const paperCtx = paper
    ? paperSummary
      ? `Current paper summary:\n${paperSummary}`
      : `Current paper: ${paper.title}, Class ${paper.className} ${paper.subject}`
    : "No paper yet.";
  return `${paperCtx}\n\nTeacher message:\n${message}`;
}

export function buildCopilotPaperEditPrompt(
  message: string,
  paper: Paper,
  conversation: Array<{ role: string; content: string }>,
  versionHistory: VersionHistoryEntry[],
): string {
  const recent = versionHistory.slice(-8);
  const history =
    recent.length > 0
      ? recent
          .map((v, i) => `- ${recent.length - i} step(s) back: "${v.label}"`)
          .join("\n")
      : "(no version history yet)";

  const convo =
    conversation.length > 0
      ? conversation
          .slice(-6)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")
      : "(start of conversation)";

  return `Current paper (numbered outline):
${formatPaperOutline(paper)}

Full paper JSON (edit this when action is update_paper):
${JSON.stringify(paper)}

Version history (for revert requests):
${history}

Recent conversation:
${convo}

Teacher message:
${message}`;
}

export function buildGeneratePaperPrompt(requirements: string, messages: string): string {
  return `Create a complete exam paper as JSON from this teacher conversation.

Full conversation (includes form selections):
${messages || requirements}

Synthesize ALL details above — class, subject, marks split, sections, question types, topics, and counts.
Each question must be syllabus-aligned and exam-ready with real MCQ options (never "Option A" placeholders).`;
}

export function buildGenerateQuestionPrompt(
  paper: Paper,
  topic: string,
  difficulty: string,
  type: string,
  marks: number,
  sectionTitle?: string,
): string {
  return `Generate one ${type} question for Class ${paper.className} ${paper.subject}.
${sectionTitle ? `Section: ${sectionTitle}\n` : ""}Topic: ${topic}. Difficulty: ${difficulty}. Marks: ${marks}.
The question must be syllabus-aligned and exam-ready for Indian school teachers.`;
}

export function buildModifyQuestionPrompt(
  question: Question,
  prompt: string,
  paper?: Paper,
): string {
  return `Modify this exam question per the teacher's instruction. Apply the change fully — update text, topic, options, and difficulty as needed.

Paper: Class ${paper?.className ?? "?"} ${paper?.subject ?? ""}
Current question:
${JSON.stringify(question, null, 2)}

Teacher instruction: ${prompt}`;
}
