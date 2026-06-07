import { z } from "zod";
import { difficultySchema, paperSchema, questionSchema, questionTypeSchema } from "./paper";

const intakeOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const intakeQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(intakeOptionSchema),
  allowMultiple: z.boolean().optional(),
});

export const taskTypeSchema = z.enum([
  "CHAT",
  "GENERATE_PAPER",
  "GENERATE_QUESTION",
  "MODIFY_QUESTION",
  "CLASSIFY_INTENT",
]);

export const triggerSchema = z.enum([
  "copilot",
  "modify_panel",
  "regenerate",
  "add_ai",
  "insert_ai",
]);

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const baseTaskSchema = z.object({
  sessionId: z.string().min(1),
  paperId: z.string().optional(),
  userId: z.string().optional(),
  idempotencyKey: z.string().min(1),
});

export const chatTaskInputSchema = baseTaskSchema.extend({
  taskType: z.literal("CHAT"),
  trigger: triggerSchema,
  input: z.object({
    message: z.string().min(1),
    messages: z.array(chatMessageSchema),
    paper: paperSchema.nullable(),
    turn: z.number().int().nonnegative().optional(),
    versionHistory: z
      .array(
        z.object({
          label: z.string(),
          createdAt: z.string(),
        }),
      )
      .optional(),
  }),
});

export const generatePaperTaskInputSchema = baseTaskSchema.extend({
  taskType: z.literal("GENERATE_PAPER"),
  trigger: triggerSchema,
  input: z.object({
    requirements: z.string().optional(),
    messages: z.array(chatMessageSchema).optional(),
    paper: paperSchema.nullable().optional(),
    className: z.string().optional(),
    subject: z.string().optional(),
  }),
});

export const generateQuestionTaskInputSchema = baseTaskSchema.extend({
  taskType: z.literal("GENERATE_QUESTION"),
  trigger: triggerSchema,
  input: z.object({
    paper: paperSchema,
    sectionId: z.string(),
    questionId: z.string().optional(),
    topic: z.string().optional(),
    difficulty: difficultySchema.optional(),
    type: questionTypeSchema.optional(),
    marks: z.number().int().positive().optional(),
  }),
});

export const modifyQuestionTaskInputSchema = baseTaskSchema.extend({
  taskType: z.literal("MODIFY_QUESTION"),
  trigger: triggerSchema,
  input: z.object({
    paper: paperSchema,
    sectionId: z.string(),
    questionId: z.string(),
    prompt: z.string().min(1),
    question: questionSchema,
  }),
});

export const llmTaskSchema = z.discriminatedUnion("taskType", [
  chatTaskInputSchema,
  generatePaperTaskInputSchema,
  generateQuestionTaskInputSchema,
  modifyQuestionTaskInputSchema,
]);

export type LlmTask = z.infer<typeof llmTaskSchema>;

export const streamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), content: z.string() }),
  z.object({ type: z.literal("tool"), name: z.string(), payload: z.unknown() }),
  z.object({ type: z.literal("paper"), paper: paperSchema }),
  z.object({ type: z.literal("question"), question: questionSchema }),
  z.object({ type: z.literal("paper_patch"), patch: z.record(z.unknown()) }),
  z.object({ type: z.literal("revert"), steps: z.number().int().positive() }),
  z.object({ type: z.literal("intake"), questions: z.array(intakeQuestionSchema) }),
  z.object({ type: z.literal("done"), meta: z.record(z.unknown()).optional() }),
  z.object({ type: z.literal("error"), message: z.string(), retryable: z.boolean().optional() }),
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;
