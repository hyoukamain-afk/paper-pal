import type { Paper } from "@/lib/types";
import { SectionBlock } from "./SectionBlock";
import { usePaperStore } from "@/store/paperStore";

export function PaperPreview({ paper }: { paper: Paper }) {
  const updateMeta = usePaperStore((s) => s.updatePaperMeta);

  return (
    <article className="rounded-2xl border bg-paper p-8 shadow-sm sm:p-10">
      <header className="border-b pb-5 text-center">
        <input
          value={paper.title}
          onChange={(e) => updateMeta({ title: e.target.value })}
          className="w-full bg-transparent text-center font-serif text-2xl font-semibold tracking-tight outline-none focus:bg-accent/40 rounded px-1"
        />
        <div className="mt-1.5 text-sm text-muted-foreground">
          {paper.className} · {paper.subject}
        </div>
        <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Total Marks:</span> {totalMarks(paper)}
          </span>
          <span>
            <span className="font-medium text-foreground">Time:</span> {paper.durationMinutes} mins
          </span>
        </div>
      </header>

      <div className="mt-6 space-y-7">
        {paper.sections.map((sec, idx) => (
          <SectionBlock key={sec.id} section={sec} index={idx} topics={paper.topics} />
        ))}
      </div>
    </article>
  );
}

function totalMarks(paper: Paper) {
  let n = 0;
  paper.sections.forEach((s) => s.questions.forEach((q) => (n += q.marks)));
  return n;
}
