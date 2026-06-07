import { useState, type DragEvent } from "react";
import {
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Gauge,
  Tag,
  Wand2,
  ListChecks,
  AlignLeft,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { Difficulty, Question } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePaperStore } from "@/store/paperStore";
import { cn } from "@/lib/utils";
import { ModifyChat } from "./ModifyChat";

const diffStyles: Record<Difficulty, string> = {
  easy: "bg-easy text-easy-foreground",
  medium: "bg-medium text-medium-foreground",
  hard: "bg-hard text-hard-foreground",
};

export function QuestionCard({
  sectionId,
  number,
  question,
  topics,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveUp,
  onMoveDown,
}: {
  sectionId: string;
  number: string;
  question: Question;
  topics: string[];
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLLIElement>) => void;
  onDragOver?: (e: DragEvent<HTMLLIElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLLIElement>) => void;
  onDrop?: (e: DragEvent<HTMLLIElement>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [modifying, setModifying] = useState(false);
  const update = usePaperStore((s) => s.updateQuestion);
  const del = usePaperStore((s) => s.deleteQuestion);
  const regen = usePaperStore((s) => s.regenerateQuestion);
  const setDiff = usePaperStore((s) => s.setDifficulty);
  const changeTopic = usePaperStore((s) => s.changeTopic);
  const changeType = usePaperStore((s) => s.changeType);

  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="group relative rounded-xl border bg-card/60 p-4 pl-7 transition-colors hover:border-foreground/20 hover:bg-card"
    >
      {/* Drag handle */}
      <div
        className="absolute left-1 top-1/2 flex -translate-y-1/2 cursor-grab items-center text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </div>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-surface-strong px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
          Q{number}
        </span>

        <div className="min-w-0 flex-1">
          {editing ? (
            <textarea
              autoFocus
              value={question.text}
              onChange={(e) => update(sectionId, question.id, { text: e.target.value })}
              onBlur={() => setEditing(false)}
              rows={Math.max(2, Math.ceil(question.text.length / 80))}
              className="w-full resize-none rounded-md border bg-background p-2 font-serif text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <p
              onClick={() => setEditing(true)}
              className="cursor-text font-serif text-[15px] leading-relaxed"
            >
              {question.text || <span className="text-muted-foreground italic">Empty question — click to edit</span>}
            </p>
          )}

          {question.type === "mcq" && (
            <ol className="mt-3 space-y-1.5">
              {(question.options ?? []).map((opt, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => update(sectionId, question.id, { correctOption: i })}
                    className={cn(
                      "grid size-4 place-items-center rounded-full border transition-colors",
                      question.correctOption === i
                        ? "border-primary bg-primary/15"
                        : "border-border hover:border-foreground/40",
                    )}
                    title="Mark as correct"
                  >
                    {question.correctOption === i && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...(question.options ?? [])];
                      next[i] = e.target.value;
                      update(sectionId, question.id, { options: next });
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="flex-1 bg-transparent font-serif text-[14px] outline-none focus:bg-accent/40 rounded px-1"
                  />
                </li>
              ))}
            </ol>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">
              <Tag className="size-3" />
              {question.topic}
            </span>
            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
              {question.marks} {question.marks === 1 ? "mark" : "marks"}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize",
                diffStyles[question.difficulty],
              )}
            >
              {question.difficulty}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
              {question.type === "mcq" ? <ListChecks className="size-3" /> : <AlignLeft className="size-3" />}
              {question.type === "mcq" ? "MCQ" : "Text"}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Question actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit manually
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => regen(sectionId, question.id)}>
              <RefreshCw className="size-3.5" /> Regenerate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setModifying(true)}>
              <Wand2 className="size-3.5" /> Modify
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onMoveUp} disabled={!onMoveUp}>
              <ArrowUp className="size-3.5" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown} disabled={!onMoveDown}>
              <ArrowDown className="size-3.5" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag className="size-3.5" /> Change topic
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {topics.map((t) => (
                  <DropdownMenuItem key={t} onClick={() => void changeTopic(sectionId, question.id, t)}>
                    {question.topic === t ? <span className="size-2 rounded-full bg-primary" /> : <span className="size-2" />}
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Gauge className="size-3.5" /> Change difficulty
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                  <DropdownMenuItem key={d} onClick={() => void setDiff(sectionId, question.id, d)}>
                    <span className={cn("size-2 rounded-full", diffStyles[d])} />
                    <span className="capitalize">{d}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Question type
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => void changeType(sectionId, question.id, "mcq")}>
              <ListChecks className="size-3.5" /> Convert to MCQ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void changeType(sectionId, question.id, "text")}>
              <AlignLeft className="size-3.5" /> Convert to Text
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => del(sectionId, question.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-3.5" /> Delete question
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {modifying && (
        <ModifyChat
          sectionId={sectionId}
          questionId={question.id}
          onClose={() => setModifying(false)}
        />
      )}
    </li>
  );
}
