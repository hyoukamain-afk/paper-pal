import { useState, type ReactNode } from "react";
import { Pencil, Sparkles } from "lucide-react";
import type { Difficulty } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const diffs: Difficulty[] = ["easy", "medium", "hard"];

export function AddQuestionPopover({
  topics,
  defaultTopic,
  defaultDifficulty,
  onAdd,
  children,
  align = "start",
}: {
  topics: string[];
  defaultTopic?: string;
  defaultDifficulty?: Difficulty;
  onAdd: (mode: "manual" | "ai", opts: { topic: string; difficulty: Difficulty }) => void;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(defaultTopic ?? topics[0] ?? "General");
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty ?? "medium");

  const handle = (mode: "manual" | "ai") => {
    onAdd(mode, { topic, difficulty });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          New question
        </div>

        <label className="text-[11px] text-muted-foreground">Topic</label>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mt-1 mb-2 w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <label className="text-[11px] text-muted-foreground">Difficulty</label>
        <div className="mt-1 mb-3 inline-flex w-full rounded-md border bg-background p-0.5">
          {diffs.map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={cn(
                "flex-1 rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                difficulty === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handle("manual")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
          >
            <Pencil className="size-3.5" /> Manual
          </button>
          <button
            onClick={() => handle("ai")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="size-3.5" /> AI
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
