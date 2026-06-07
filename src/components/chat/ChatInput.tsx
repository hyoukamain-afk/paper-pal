import { useState, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { usePaperStore } from "@/store/paperStore";

export function ChatInput({ disabled }: { disabled?: boolean }) {
  const [value, setValue] = useState("");
  const send = usePaperStore((s) => s.sendUserMessage);

  const submit = async () => {
    const v = value.trim();
    if (!v || disabled) return;
    setValue("");
    await send(v);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        disabled={disabled}
        rows={1}
        placeholder="Describe the paper you'd like to build…"
        className="min-h-[48px] max-h-40 resize-none border-0 bg-transparent px-4 py-3 pr-12 text-sm text-[var(--chat-user)] placeholder:text-muted-foreground shadow-none focus-visible:ring-0"
      />
      <Button
        size="icon"
        onClick={submit}
        disabled={disabled || !value.trim()}
        className="absolute bottom-2 right-2 size-8 rounded-full text-white hover:opacity-90"
        style={{ backgroundColor: "#f97316" }}
      >
        <ArrowUp className="size-4" />
      </Button>
    </div>
  );
}
