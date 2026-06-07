import { FileText, MessageSquare, Sparkles } from "lucide-react";
import { usePaperStore } from "@/store/paperStore";

export function EmptyState() {
  const loadSample = usePaperStore((s) => s.loadSample);
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-card shadow-sm border">
          <FileText className="size-5 text-primary" />
        </div>
        <h2 className="mt-5 font-serif text-2xl font-semibold tracking-tight">
          A blank slate, ready when you are
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ask the copilot on the right to draft your paper. It will gather a few details, then build
          a balanced exam you can edit, regenerate and export.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={loadSample}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            <Sparkles className="size-3.5" />
            Load sample paper
          </button>
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <MessageSquare className="size-3.5" />
          Or just type a request in the chat — like “Class 10 Physics, 40 marks”.
        </div>
      </div>
    </div>
  );
}
