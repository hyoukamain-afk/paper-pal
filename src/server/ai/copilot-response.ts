import { z } from "zod";
import { computeTotalMarks, paperSchema, parsePaper } from "@/lib/schemas/paper";
import type { Paper } from "@/lib/types";

export const copilotResponseSchema = z.object({
  reply: z.string(),
  action: z.enum(["none", "update_paper", "revert"]).default("none"),
  paper: paperSchema.optional().nullable(),
  revertSteps: z.number().int().positive().optional(),
});

export type CopilotResponse = z.infer<typeof copilotResponseSchema>;

export function parseCopilotResponse(raw: string): CopilotResponse {
  try {
    const json = JSON.parse(raw) as unknown;
    const parsed = copilotResponseSchema.safeParse(json);
    if (parsed.success) return parsed.data;
  } catch {
    /* fall through */
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = copilotResponseSchema.safeParse(JSON.parse(match[0]));
      if (parsed.success) return parsed.data;
    } catch {
      /* */
    }
  }

  return { reply: raw.trim() || "Done.", action: "none" };
}

export function normalizeCopilotPaper(paper: Paper, sources?: Paper["syllabusSources"]): Paper {
  const withSources = sources?.length ? { ...paper, syllabusSources: sources } : paper;
  const parsed = parsePaper(withSources);
  const base = parsed.success ? parsed.data : paper;
  return { ...base, totalMarks: computeTotalMarks(base) };
}
