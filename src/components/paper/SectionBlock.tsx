import { Plus } from "lucide-react";
import type { Section } from "@/lib/types";
import { QuestionCard } from "./QuestionCard";
import { AddQuestionPopover } from "./AddQuestionPopover";
import { usePaperStore } from "@/store/paperStore";
import { useRef, useState } from "react";

export function SectionBlock({
  section,
  index,
  topics,
}: {
  section: Section;
  index: number;
  topics: string[];
}) {
  const addQuestion = usePaperStore((s) => s.addQuestion);
  const insertAt = usePaperStore((s) => s.insertQuestionAt);
  const reorder = usePaperStore((s) => s.reorderQuestion);
  const setSectionTitle = usePaperStore((s) => s.setSectionTitle);
  const setSectionInstruction = usePaperStore((s) => s.setSectionInstruction);
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const target = section.targetQuestions ?? section.questions.length;
  const actual = section.questions.length;
  const mismatch = target !== actual;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <input
          value={section.title}
          onChange={(e) => setSectionTitle(section.id, e.target.value)}
          aria-label="Section title"
          className="min-w-0 flex-1 bg-transparent font-serif text-lg font-semibold tracking-tight outline-none ring-offset-2 focus:rounded-md focus:px-1.5 focus:py-0.5 focus:ring-2 focus:ring-ring"
        />
        <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
          {actual} questions
        </span>
      </div>
      <textarea
        value={section.instruction}
        onChange={(e) => setSectionInstruction(section.id, e.target.value)}
        rows={2}
        aria-label="Section instructions"
        className="mb-3 w-full resize-none bg-transparent text-xs italic leading-relaxed text-muted-foreground outline-none ring-offset-2 focus:rounded-md focus:px-1.5 focus:py-1 focus:ring-2 focus:ring-ring"
      />

      {mismatch && (
        <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-800">
          Target is <strong>{target}</strong> questions but this section has <strong>{actual}</strong>.
        </div>
      )}

      <ol className="space-y-1">
        {section.questions.map((q, i) => (
          <div key={q.id}>
            <InsertBand
              topics={topics}
              defaultTopic={q.topic}
              defaultDifficulty={q.difficulty}
              onAdd={(mode, opts) => insertAt(section.id, i, mode, opts)}
            />
            <QuestionCard
              sectionId={section.id}
              number={`${romanize(index + 1)}.${i + 1}`}
              question={q}
              topics={topics}
              draggable
              onDragStart={() => { dragIdx.current = i; }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDragLeave={() => setOverIdx((v) => (v === i ? null : v))}
              onDrop={() => {
                const from = dragIdx.current;
                setOverIdx(null);
                dragIdx.current = null;
                if (from != null && from !== i) reorder(section.id, from, i);
              }}
              onMoveUp={i > 0 ? () => reorder(section.id, i, i - 1) : undefined}
              onMoveDown={i < section.questions.length - 1 ? () => reorder(section.id, i, i + 1) : undefined}
            />
          </div>
        ))}
      </ol>

      <div className="mt-3">
        <AddQuestionPopover
          topics={topics}
          defaultTopic={section.questions[section.questions.length - 1]?.topic}
          defaultDifficulty={section.questions[section.questions.length - 1]?.difficulty}
          onAdd={(mode, opts) => addQuestion(section.id, mode, opts)}
        >
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Plus className="size-3.5" />
            Add question
          </button>
        </AddQuestionPopover>
      </div>
    </section>
  );
}

function InsertBand({
  topics,
  defaultTopic,
  defaultDifficulty,
  onAdd,
}: {
  topics: string[];
  defaultTopic?: string;
  defaultDifficulty?: import("@/lib/types").Difficulty;
  onAdd: (mode: "manual" | "ai", opts: { topic: string; difficulty: import("@/lib/types").Difficulty }) => void;
}) {
  return (
    <div className="group/insert relative -my-1 flex h-3 items-center justify-center">
      <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-primary/40 opacity-0 transition-opacity group-hover/insert:opacity-100" />
      <AddQuestionPopover
        topics={topics}
        defaultTopic={defaultTopic}
        defaultDifficulty={defaultDifficulty}
        onAdd={onAdd}
        align="center"
      >
        <button
          className="z-10 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-primary hover:text-primary-foreground group-hover/insert:opacity-100"
          aria-label="Insert question here"
        >
          <Plus className="size-3" />
        </button>
      </AddQuestionPopover>
    </div>
  );
}

function romanize(n: number) {
  return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][n - 1] ?? String(n);
}
