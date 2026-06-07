import { z } from "zod";
import { defaultIntakeQuestions, type IntakeQuestion } from "@/lib/intake";

const intakeOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
});

const intakeQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  options: z.array(intakeOptionSchema).min(2).max(8),
  allowMultiple: z.boolean().optional(),
});

export const intakeResponseSchema = z.object({
  reply: z.string(),
  action: z.enum(["ask", "generate"]),
  questions: z.array(intakeQuestionSchema).optional(),
});

export type IntakeResponse = z.infer<typeof intakeResponseSchema>;

function normalizeQuestions(questions: IntakeQuestion[] | undefined): IntakeQuestion[] {
  const qs = questions?.filter((q) => q.options.length >= 2) ?? [];
  return qs.length > 0 ? qs.slice(0, 4) : defaultIntakeQuestions();
}

export function parseIntakeResponse(raw: string): IntakeResponse {
  try {
    const json = JSON.parse(raw) as unknown;
    const parsed = intakeResponseSchema.safeParse(json);
    if (parsed.success) {
      const data = parsed.data;
      if (data.action === "ask") {
        return { ...data, questions: normalizeQuestions(data.questions) };
      }
      return data;
    }
  } catch {
    /* fall through */
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = intakeResponseSchema.safeParse(JSON.parse(match[0]));
      if (parsed.success) {
        const data = parsed.data;
        if (data.action === "ask") {
          return { ...data, questions: normalizeQuestions(data.questions) };
        }
        return data;
      }
    } catch {
      /* */
    }
  }

  return {
    reply: "A few quick picks before I draft:",
    action: "ask",
    questions: defaultIntakeQuestions(),
  };
}
