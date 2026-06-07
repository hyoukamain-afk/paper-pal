import type { Paper } from "@/lib/types";

/** Human-readable numbered outline so the copilot can target "Section B Q2". */
export function formatPaperOutline(paper: Paper): string {
  const lines: string[] = [
    `Title: ${paper.title}`,
    `Class ${paper.className} · ${paper.subject} · ${paper.totalMarks} marks · ${paper.durationMinutes} min · ${paper.difficulty}`,
    `Topics: ${paper.topics.join(", ")}`,
  ];

  paper.sections.forEach((sec, si) => {
    lines.push(`\n${sec.title} [section_id=${sec.id}]`);
    sec.questions.forEach((q, qi) => {
      const preview = q.text.replace(/\s+/g, " ").slice(0, 120);
      const opts = q.type === "mcq" ? " MCQ" : "";
      lines.push(
        `  Q${qi + 1} [id=${q.id}] (${q.marks}m, ${q.difficulty}, ${q.topic}${opts}): ${preview}${q.text.length > 120 ? "…" : ""}`,
      );
    });
  });

  return lines.join("\n");
}
