import type { StreamEvent } from "@/lib/schemas/task";
import { streamEventSchema } from "@/lib/schemas/task";

/** Parse one SSE `data:` line into a stream event. */
export function parseSseDataLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const json = trimmed.slice(5).trim();
  if (json === "[DONE]") return { type: "done" };
  try {
    const parsed = JSON.parse(json) as unknown;
    const result = streamEventSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Consume an SSE response body and invoke handlers per event. */
export async function consumeSseStream(
  response: Response,
  handlers: {
    onEvent: (event: StreamEvent) => void;
    onError?: (err: Error) => void;
  },
): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed (${response.status})`);
  }
  const body = response.body;
  if (!body) throw new Error("No response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const block of parts) {
        for (const line of block.split("\n")) {
          const event = parseSseDataLine(line);
          if (event) handlers.onEvent(event);
        }
      }
    }
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const event = parseSseDataLine(line);
        if (event) handlers.onEvent(event);
      }
    }
  } catch (err) {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}

/** Replay token events into a growing string (client-side streaming UI). */
export async function replayStreamEvents(
  events: StreamEvent[],
  onToken: (content: string) => void,
  delayMs = 0,
): Promise<void> {
  let acc = "";
  for (const ev of events) {
    if (ev.type === "token") {
      acc += ev.content;
      onToken(acc);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Encode events as SSE bytes for the server. */
export function encodeSseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function sseResponse(eventStream: AsyncIterable<StreamEvent>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of eventStream) {
          controller.enqueue(encoder.encode(encodeSseEvent(event)));
          if (event.type === "error" || event.type === "done") break;
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        controller.enqueue(
          encoder.encode(encodeSseEvent({ type: "error", message, retryable: true })),
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
