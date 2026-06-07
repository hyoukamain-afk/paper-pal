import { Sparkles, User } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IntakeQuestions } from "./IntakeQuestions";

function renderInline(text: string) {
  // very small markdown: **bold** and *italic*
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MessageBubble({
  message,
  intakeActive = false,
}: {
  message: ChatMessage;
  intakeActive?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full",
          isUser ? "bg-[var(--chat-user)] text-[var(--chat-user-foreground)]" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-[var(--chat-user)] text-[var(--chat-user-foreground)]"
            : "bg-card border rounded-tl-sm shadow-sm",
        )}
      >
        <div className={cn("whitespace-pre-wrap", message.streaming && "blink-caret")}>
          {message.content.split("\n").map((line, i) => (
            <span key={i}>
              {renderInline(line)}
              {i < message.content.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>
        {message.intakeQuestions && message.intakeQuestions.length > 0 && (
          <IntakeQuestions
            messageId={message.id}
            questions={message.intakeQuestions}
            disabled={!intakeActive || message.streaming}
            submitted={message.intakeSubmitted}
            savedSelections={message.intakeSelections}
          />
        )}
      </div>
    </div>
  );
}
