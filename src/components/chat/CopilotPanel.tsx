import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { usePaperStore } from "@/store/paperStore";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { SuggestionChips } from "./SuggestionChips";
import { Button } from "@/components/ui/button";

export function CopilotPanel() {
  const messages = usePaperStore((s) => s.messages);
  const paper = usePaperStore((s) => s.paper);
  const paperVersions = usePaperStore((s) => s.paperVersions);
  const isStreaming = usePaperStore((s) => s.isStreaming);
  const chatError = usePaperStore((s) => s.chatError);
  const retryLastMessage = usePaperStore((s) => s.retryLastMessage);
  const clearChatError = usePaperStore((s) => s.clearChatError);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const activeIntakeId = [...messages]
    .reverse()
    .find((m) => m.intakeQuestions && m.intakeQuestions.length > 0)?.id;

  return (
    <div className="copilot-scope flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 bg-background/40 px-4">
        <div
          className="grid size-6 place-items-center rounded-md"
          style={{ backgroundColor: "rgba(249, 115, 22, 0.15)", color: "#f97316" }}
        >
          <Sparkles className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Copilot</div>
          {paper && (
            <div className="truncate text-[10.5px] text-muted-foreground">
              Editing paper · {paperVersions.length} saved version
              {paperVersions.length === 1 ? "" : "s"} · say &quot;undo&quot; to revert
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-5"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages
            .filter((m) => !m.hidden)
            .map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                intakeActive={m.id === activeIntakeId && !isStreaming}
              />
            ))}
          {messages.filter((m) => !m.hidden).length <= 1 && <SuggestionChips />}
          {chatError && (
            <div
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <p>{chatError}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => retryLastMessage()}>
                  Retry
                </Button>
                <Button size="sm" variant="ghost" onClick={clearChatError}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t bg-background/80 px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <ChatInput disabled={isStreaming} />
          <div className="mt-1.5 px-1 text-[10.5px] text-muted-foreground">
            Ask to edit any question by number, reorder sections, or undo changes. Syllabus-backed via your NCERT library.
          </div>
        </div>
      </div>
    </div>
  );
}
