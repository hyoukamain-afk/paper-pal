import type { ChatMessage, Paper, PaperVersion } from "@/lib/types";
import { getOrCreatePaperId, getOrCreateSessionId } from "@/lib/session";

const STORAGE_KEY = "paperly_workspace_v1";

export type PersistedWorkspace = {
  mode: "empty" | "paper";
  paper: Paper | null;
  messages: ChatMessage[];
  turn: number;
  paperVersions: PaperVersion[];
  updatedAt: string;
};

export function loadWorkspace(): PersistedWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedWorkspace;
  } catch {
    return null;
  }
}

export function saveWorkspace(state: PersistedWorkspace): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // quota exceeded — ignore
  }
}

export function clearWorkspaceStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getPersistenceMeta() {
  return {
    sessionId: getOrCreateSessionId(),
    paperId: getOrCreatePaperId(),
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSaveWorkspace(state: PersistedWorkspace, ms = 500): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveWorkspace(state);
    saveTimer = null;
  }, ms);
}
