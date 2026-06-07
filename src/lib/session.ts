const SESSION_KEY = "paperly_session_id";
const PAPER_KEY = "paperly_paper_id";
const LAUNCH_CONTEXT_KEY = "paperly_launch_context";

export type LaunchContext = {
  subject?: string;
  className?: string;
  test?: string;
  autoStart: boolean;
};

let deepLinkApplied = false;

/** Apply SchoolOS / teacher-portal query params before any session API calls. */
export function applyDeepLinkFromUrl(): void {
  if (typeof window === "undefined" || deepLinkApplied) return;
  deepLinkApplied = true;

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("sessionId")?.trim();
  const paperId = params.get("paperId")?.trim();

  if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
  if (paperId) localStorage.setItem(PAPER_KEY, paperId);

  const launch: LaunchContext = {
    subject: params.get("subject")?.trim() || undefined,
    className: params.get("class")?.trim() || undefined,
    test: params.get("test")?.trim() || undefined,
    autoStart: params.get("autoStart") === "1",
  };

  if (launch.subject || launch.className || launch.test || launch.autoStart) {
    sessionStorage.setItem(LAUNCH_CONTEXT_KEY, JSON.stringify(launch));
  }

  if (sessionId || paperId || launch.subject || launch.test || launch.className) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

export function peekLaunchContext(): LaunchContext | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(LAUNCH_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LaunchContext;
  } catch {
    return null;
  }
}

export function consumeLaunchContext(): LaunchContext | null {
  const ctx = peekLaunchContext();
  if (ctx) sessionStorage.removeItem(LAUNCH_CONTEXT_KEY);
  return ctx;
}

export function buildSchoolOsLaunchPrompt(ctx: LaunchContext): string {
  const parts = ["Create an exam paper"];
  if (ctx.test) parts.push(`for ${ctx.test}`);
  if (ctx.className) parts.push(`for Class ${ctx.className}`);
  if (ctx.subject) parts.push(`in ${ctx.subject}`);
  return `${parts.join(" ")}.`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  applyDeepLinkFromUrl();
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getOrCreatePaperId(): string {
  if (typeof window === "undefined") return "paper_default";
  applyDeepLinkFromUrl();
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
