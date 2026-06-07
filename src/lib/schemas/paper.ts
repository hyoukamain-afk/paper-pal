import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const questionTypeSchema = z.enum(["mcq", "text"]);

export const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  topic: z.string(),
  marks: z.number().int().positive(),
  difficulty: difficultySchema,
  type: questionTypeSchema,
  options: z.array(z.string()).optional(),
  correctOption: z.number().int().nonnegative().optional(),
});

export const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  instruction: z.string(),
  questions: z.array(questionSchema),
  targetQuestions: z.number().int().positive().optional(),
});

export const syllabusSourceSchema = z.object({
  bookId: z.string(),
  title: z.string(),
  board: z.string(),
  chapters: z.array(z.string()),
});

export const paperSchema = z.object({
  title: z.string(),
  className: z.string(),
  subject: z.string(),
  topics: z.array(z.string()),
  totalMarks: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  difficulty: difficultySchema,
  sections: z.array(sectionSchema),
  topicWeights: z.record(z.string(), z.number()).optional(),
  syllabusSources: z.array(syllabusSourceSchema).optional(),
});

export type PaperInput = z.infer<typeof paperSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;

export function parsePaper(data: unknown) {
  return paperSchema.safeParse(data);
}

export function parseQuestion(data: unknown) {
  return questionSchema.safeParse(data);
}

export function computeTotalMarks(paper: PaperInput): number {
  return paper.sections.reduce(
    (sum, sec) => sum + sec.questions.reduce((s, q) => s + q.marks, 0),
    0,
  );
}
