import type { Paper } from "@/lib/types";
import type { ChatMessage } from "@/lib/types";
import { getOrCreatePaperId, getOrCreateSessionId } from "@/lib/session";

export type ServerSession = {
  paper: Paper | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    state?: string;
  }>;
};

export async function loadSessionFromServer(): Promise<ServerSession | null> {
  try {
    const params = new URLSearchParams({
      sessionId: getOrCreateSessionId(),
      paperId: getOrCreatePaperId(),
    });
    const res = await fetch(`/api/session/load?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as ServerSession;
    return data;
  } catch {
    return null;
  }
}

export function mapServerMessages(
  rows: ServerSession["messages"],
): ChatMessage[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    state: m.state as ChatMessage["state"],
  }));
}
