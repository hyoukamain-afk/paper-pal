import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { IntakeQuestion, IntakeSelections } from "@/lib/types";
import { formatIntakeReply } from "@/lib/intake";
import { usePaperStore } from "@/store/paperStore";
import { cn } from "@/lib/utils";

export function IntakeQuestions({
  messageId,
  questions,
  disabled,
  submitted,
  savedSelections,
}: {
  messageId: string;
  questions: IntakeQuestion[];
  disabled?: boolean;
  submitted?: boolean;
  savedSelections?: IntakeSelections;
}) {
  const sendIntake = usePaperStore((s) => s.sendUserMessage);
  const markIntakeSubmitted = usePaperStore((s) => s.markIntakeSubmitted);
  const isStreaming = usePaperStore((s) => s.isStreaming);

  const [selections, setSelections] = useState<IntakeSelections>(() => savedSelections ?? {});

  const displaySelections = submitted ? (savedSelections ?? selections) : selections;

  const canContinue = useMemo(
    () => questions.every((q) => (displaySelections[q.id]?.length ?? 0) > 0),
    [questions, displaySelections],
  );

  const toggle = (question: IntakeQuestion, optionId: string) => {
    if (disabled || submitted || isStreaming) return;
    setSelections((prev) => {
      const cur = prev[question.id] ?? [];
      if (question.allowMultiple) {
        const next = cur.includes(optionId)
          ? cur.filter((id) => id !== optionId)
          : [...cur, optionId];
        return { ...prev, [question.id]: next };
      }
      const next = cur[0] === optionId ? [] : [optionId];
      return { ...prev, [question.id]: next };
    });
  };

  const handleContinue = () => {
    if (!canContinue || disabled || submitted || isStreaming) return;
    const reply = formatIntakeReply(questions, selections);
    markIntakeSubmitted(messageId, selections);
    void sendIntake(reply, { hidden: true });
  };

  const locked = disabled || submitted || isStreaming;

  return (
    <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
      {questions.map((q) => {
        const selected = displaySelections[q.id] ?? [];
        return (
          <div key={q.id}>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {q.prompt}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const isSelected = selected.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(q, opt.id)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/25"
                        : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                      locked && !isSelected && "opacity-60",
                      locked && "cursor-default",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {!submitted && (
        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <span className="text-[11px] text-muted-foreground">
            {canContinue ? "Ready to continue" : "Pick one option in each section"}
          </span>
          <button
            type="button"
            disabled={!canContinue || locked}
            onClick={handleContinue}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              canContinue
                ? "bg-foreground text-background hover:opacity-90"
                : "bg-muted text-muted-foreground",
              locked && "pointer-events-none opacity-50",
            )}
          >
            Continue
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
