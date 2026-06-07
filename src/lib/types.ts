export type Difficulty = "easy" | "medium" | "hard";
export type QuestionType = "mcq" | "text";

export type Question = {
  id: string;
  text: string;
  topic: string;
  marks: number;
  difficulty: Difficulty;
  type: QuestionType;
  options?: string[];
  correctOption?: number;
};

export type Section = {
  id: string;
  title: string;
  instruction: string;
  questions: Question[];
  targetQuestions?: number;
};

/** Textbook(s) the agent used to ground this paper (set server-side). */
export type SyllabusSource = {
  bookId: string;
  title: string;
  board: string;
  chapters: string[];
};

export type Paper = {
  title: string;
  className: string;
  subject: string;
  topics: string[];
  totalMarks: number;
  durationMinutes: number;
  difficulty: Difficulty;
  sections: Section[];
  topicWeights?: Record<string, number>;
  syllabusSources?: SyllabusSource[];
};

import type { IntakeQuestion, IntakeSelections } from "@/lib/intake";

export type { IntakeQuestion, IntakeSelections };

export type ChatRole = "user" | "assistant";
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  streaming?: boolean;
  state?: "welcome" | "clarifying" | "generating" | "updating" | "error";
  intakeQuestions?: IntakeQuestion[];
  intakeSelections?: IntakeSelections;
  intakeSubmitted?: boolean;
  /** Sent to API but not shown in the chat UI (intake form answers). */
  hidden?: boolean;
};

/** Snapshot for copilot undo / revert. */
export type PaperVersion = {
  id: string;
  paper: Paper;
  createdAt: string;
  label: string;
  source: "copilot" | "modify_panel" | "manual" | "generate";
};

export type VersionHistoryEntry = {
  label: string;
  createdAt: string;
};
