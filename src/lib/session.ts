const SESSION_KEY = "paperly_session_id";
const PAPER_KEY = "paperly_paper_id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getOrCreatePaperId(): string {
  if (typeof window === "undefined") return "paper_default";
  let id = localStorage.getItem(PAPER_KEY);
  if (!id) {
    id = `paper_${crypto.randomUUID()}`;
    localStorage.setItem(PAPER_KEY, id);
  }
  return id;
}

export function resetPaperId(): void {
  if (typeof window === "undefined") return;
  const id = `paper_${crypto.randomUUID()}`;
  localStorage.setItem(PAPER_KEY, id);
}

export function createIdempotencyKey(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
