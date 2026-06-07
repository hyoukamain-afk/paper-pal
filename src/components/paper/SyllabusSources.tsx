import { BookOpen } from "lucide-react";
import type { Paper } from "@/lib/types";

export function SyllabusSources({ paper }: { paper: Paper }) {
  const sources = paper.syllabusSources ?? [];
  if (sources.length === 0) return null;

  return (
    <section className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <BookOpen className="size-3.5" />
        Syllabus sources
      </div>
      <ul className="space-y-1.5 text-sm text-foreground">
        {sources.map((s) => (
          <li key={s.bookId}>
            <span className="font-medium">{s.title}</span>
            <span className="text-muted-foreground"> · {s.board}</span>
            {s.chapters.length > 0 && (
              <span className="block text-xs text-muted-foreground">
                Chapters: {s.chapters.join(", ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
