import type { Paper, Question, VersionHistoryEntry } from "@/lib/types";
import type { ChatMessage } from "@/lib/types";
import type { LlmTask, StreamEvent } from "@/lib/schemas/task";
import { consumeSseStream } from "@/lib/streaming";
import { createIdempotencyKey, getOrCreatePaperId, getOrCreateSessionId } from "@/lib/session";

export const useMockAi = import.meta.env.VITE_USE_MOCK_AI === "true";

type ChatParams = {
  message: string;
  messages: ChatMessage[];
  paper: Paper | null;
  turn: number;
  versionHistory?: VersionHistoryEntry[];
  onEvent: (event: StreamEvent) => void;
};

type QuestionParams = {
  paper: Paper;
  sectionId: string;
  questionId?: string;
  topic?: string;
  difficulty?: Question["difficulty"];
  type?: Question["type"];
  marks?: number;
  trigger: "regenerate" | "add_ai" | "insert_ai";
};

type ModifyParams = {
  paper: Paper;
  sectionId: string;
  questionId: string;
  question: Question;
  prompt: string;
  onEvent: (event: StreamEvent) => void;
};

async function postTask(
  path: string,
  task: Omit<LlmTask, "sessionId" | "idempotencyKey" | "paperId"> & {
    sessionId?: string;
    paperId?: string;
    idempotencyKey?: string;
  },
  stream: boolean,
  onEvent?: (event: StreamEvent) => void,
): Promise<StreamEvent[]> {
  const body = {
    ...task,
    sessionId: task.sessionId ?? getOrCreateSessionId(),
    paperId: task.paperId ?? getOrCreatePaperId(),
    idempotencyKey: task.idempotencyKey ?? createIdempotencyKey(task.taskType),
    stream,
  } as LlmTask;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (stream) headers.Accept = "text/event-stream";

  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (stream && onEvent) {
    const events: StreamEvent[] = [];
    await consumeSseStream(res, {
      onEvent: (ev) => {
        events.push(ev);
        onEvent(ev);
      },
    });
    return events;
  }

  const json = (await res.json()) as { events?: StreamEvent[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  const events = json.events ?? [];
  for (const ev of events) onEvent?.(ev);
  return events;
}

export async function runChat(params: ChatParams): Promise<StreamEvent[]> {
  return postTask(
    "/api/ai/chat",
    {
      taskType: "CHAT",
      trigger: "copilot",
      input: {
        message: params.message,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        paper: params.paper,
        turn: params.turn,
        versionHistory: params.versionHistory,
      },
    },
    true,
    params.onEvent,
  );
}

export async function generatePaper(
  requirements: string,
  messages: ChatMessage[],
): Promise<StreamEvent[]> {
  return postTask(
    "/api/ai/paper",
    {
      taskType: "GENERATE_PAPER",
      trigger: "copilot",
      input: {
        requirements,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
    },
    false,
  );
}

export async function generateQuestion(params: QuestionParams): Promise<StreamEvent[]> {
  return postTask(
    "/api/ai/question/generate",
    {
      taskType: "GENERATE_QUESTION",
      trigger: params.trigger,
      input: {
        paper: params.paper,
        sectionId: params.sectionId,
        questionId: params.questionId,
        topic: params.topic,
        difficulty: params.difficulty,
        type: params.type,
        marks: params.marks,
      },
    },
    false,
  );
}

export async function modifyQuestion(params: ModifyParams): Promise<StreamEvent[]> {
  return postTask(
    "/api/ai/question/modify",
    {
      taskType: "MODIFY_QUESTION",
      trigger: "modify_panel",
      input: {
        paper: params.paper,
        sectionId: params.sectionId,
        questionId: params.questionId,
        question: params.question,
        prompt: params.prompt,
      },
    },
    true,
    params.onEvent,
  );
}

export async function saveSession(paper: Paper | null, messages: ChatMessage[]): Promise<void> {
  try {
    await fetch("/api/session/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getOrCreateSessionId(),
        paperId: getOrCreatePaperId(),
        paper,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          state: m.state,
        })),
      }),
    });
  } catch {
    // offline — localStorage handles persistence
  }
}
