import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { usePaperStore } from "@/store/paperStore";
import { cn } from "@/lib/utils";

type Bubble = { id: string; role: "user" | "assistant"; content: string; streaming?: boolean };

let bid = 0;
const nid = () => `b_${Date.now().toString(36)}_${(bid++).toString(36)}`;

export function ModifyChat({
  sectionId,
  questionId,
  onClose,
}: {
  sectionId: string;
  questionId: string;
  onClose: () => void;
}) {
  const modifyQuestion = usePaperStore((s) => s.modifyQuestion);
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: nid(),
      role: "assistant",
      content:
        "What would you like to change? e.g. 'make it numerical', 'add a real-world scenario', 'shorten it'.",
    },
  ]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    const v = value.trim();
    if (!v || busy) return;
    setValue("");
    setBusy(true);
    setError(null);
    const userId = nid();
    const aid = nid();
    setBubbles((b) => [
      ...b,
      { id: userId, role: "user", content: v },
      { id: aid, role: "assistant", content: "Applying your changes…", streaming: true },
    ]);

    const ok = await modifyQuestion(sectionId, questionId, v);
    if (ok) {
      setBubbles((b) =>
        b.map((x) =>
          x.id === aid
            ? { ...x, content: `Done — updated based on: "${v}"`, streaming: false }
            : x,
        ),
      );
    } else {
      setError("Modify failed — see toast for details");
      setBubbles((b) =>
        b.map((x) =>
          x.id === aid
            ? { ...x, content: "Couldn't apply that change. Try rephrasing.", streaming: false }
            : x,
        ),
      );
    }
    setBusy(false);
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-surface/60">
      <div className="flex items-center justify-between border-b bg-background/60 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="size-3.5 text-primary" />
          Modify with AI
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="max-h-44 space-y-2 overflow-y-auto px-3 py-3">
        {bubbles.map((b) => (
          <div key={b.id} className={cn("flex", b.role === "user" && "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-2.5 py-1.5 text-[12.5px] leading-relaxed",
                b.role === "user" ? "bg-foreground text-background" : "border bg-card",
                b.streaming && "blink-caret",
              )}
            >
              {b.content || (b.streaming ? "Thinking…" : "")}
            </div>
          </div>
        ))}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>

      <div className="flex items-end gap-2 border-t bg-background/60 p-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={busy}
          placeholder="Tell the AI how to modify this question…"
          className="min-h-[34px] max-h-24 flex-1 resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="grid size-7 place-items-center rounded-md bg-foreground text-background disabled:opacity-40"
          aria-label="Send"
        >
          <ArrowUp className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
