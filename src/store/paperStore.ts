import { create } from "zustand";
import type { ChatMessage, Difficulty, Paper, PaperVersion, Question, QuestionType, Section } from "@/lib/types";
import { pushPaperVersion, revertPaperVersions } from "@/lib/paper-versions";
import { createSamplePaper } from "@/data/samplePaper";
import { blankQuestion, generateQuestion } from "@/data/mockGenerator";
import { defaultIntakeQuestions, type IntakeSelections } from "@/lib/intake";
import {
  followUpReplies,
  generatedSummary,
  generatingReply,
  welcomeMessage,
} from "@/data/chatScripts";
import * as aiClient from "@/services/aiClient";
import { toast } from "sonner";
import { loadSessionFromServer, mapServerMessages } from "@/services/sessionClient";
import {
  clearWorkspaceStorage,
  debouncedSaveWorkspace,
  loadWorkspace,
  type PersistedWorkspace,
} from "@/store/persistence";
import { resetPaperId } from "@/lib/session";
import { applyQuestionToPaper } from "@/lib/paper-utils";
import { syncInstructionMarks } from "@/lib/section-instruction";

type Mode = "empty" | "paper";

type State = {
  mode: Mode;
  paper: Paper | null;
  paperVersions: PaperVersion[];
  messages: ChatMessage[];
  isStreaming: boolean;
  turn: number;
  lastUserMessage: string | null;
  chatError: string | null;
  hydrated: boolean;
};

type Actions = {
  hydrate: () => Promise<void>;
  resetEmpty: () => void;
  loadSample: () => void;
  sendUserMessage: (text: string, opts?: { hidden?: boolean }) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  clearChatError: () => void;
  markIntakeSubmitted: (messageId: string, selections: IntakeSelections) => void;
  updateQuestion: (sectionId: string, questionId: string, patch: Partial<Question>) => void;
  deleteQuestion: (sectionId: string, questionId: string) => void;
  regenerateQuestion: (sectionId: string, questionId: string) => Promise<void>;
  modifyQuestion: (sectionId: string, questionId: string, prompt: string) => Promise<boolean>;
  addQuestion: (
    sectionId: string,
    mode: "manual" | "ai",
    opts?: { topic?: string; difficulty?: Difficulty },
  ) => Promise<void>;
  insertQuestionAt: (
    sectionId: string,
    index: number,
    mode: "manual" | "ai",
    opts?: { topic?: string; difficulty?: Difficulty },
  ) => Promise<void>;
  reorderQuestion: (sectionId: string, from: number, to: number) => void;
  setDifficulty: (sectionId: string, questionId: string, d: Difficulty) => Promise<void>;
  changeTopic: (sectionId: string, questionId: string, topic: string) => Promise<void>;
  addConcepts: (sectionId: string, questionId: string) => void;
  changeType: (sectionId: string, questionId: string, type: QuestionType) => Promise<void>;
  updatePaperMeta: (
    patch: Partial<
      Pick<Paper, "title" | "className" | "subject" | "durationMinutes" | "totalMarks">
    >,
  ) => void;
  setOverallDifficulty: (d: Difficulty) => void;
  applyOverallDifficulty: (d: Difficulty) => Promise<void>;
  setSectionQuestionCount: (sectionId: string, count: number) => void;
  setSectionTargetQuestions: (sectionId: string, count: number) => void;
  setSectionMarksPerQ: (sectionId: string, marks: number) => void;
  setSectionTitle: (sectionId: string, title: string) => void;
  setSectionInstruction: (sectionId: string, instruction: string) => void;
  addSection: () => void;
  setTopicWeight: (topic: string, weight: number) => void;
};

let mid = 0;
const messageId = () => `m_${Date.now().toString(36)}_${(mid++).toString(36)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const defaultMessages = (): ChatMessage[] => [
  { id: messageId(), role: "assistant", content: welcomeMessage, state: "welcome" },
];

function persist(get: () => State & Actions) {
  const s = get();
  debouncedSaveWorkspace({
    mode: s.mode,
    paper: s.paper,
    messages: s.messages,
    turn: s.turn,
    paperVersions: s.paperVersions,
    updatedAt: new Date().toISOString(),
  });
  void aiClient.saveSession(s.paper, s.messages);
}

function versionHistoryForApi(versions: PaperVersion[]) {
  return versions.slice(-8).map((v) => ({ label: v.label, createdAt: v.createdAt }));
}

function applyCopilotPaperUpdate(
  set: (fn: (s: State) => Partial<State> | State) => void,
  get: () => State,
  nextPaper: Paper,
  source: PaperVersion["source"] = "copilot",
) {
  const current = get().paper;
  const label = get().lastUserMessage ?? "Copilot edit";
  set((s) => ({
    paperVersions: current
      ? pushPaperVersion(s.paperVersions, current, `Before: ${label.slice(0, 100)}`, source)
      : s.paperVersions,
    paper: nextPaper,
    mode: "paper" as Mode,
  }));
}

async function streamMessageLocal(
  set: (fn: (s: State) => Partial<State> | State) => void,
  full: string,
  state: ChatMessage["state"],
) {
  const id = messageId();
  set((s) => ({
    messages: [...s.messages, { id, role: "assistant", content: "", streaming: true, state }],
  }));
  const tokens = full.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    await sleep(18);
    const upTo = tokens.slice(0, i + 1).join("");
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: upTo } : m)),
    }));
  }
  set((s) => ({
    messages: s.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
  }));
}

async function sendUserMessageMock(
  set: (fn: (s: State) => Partial<State> | State) => void,
  get: () => State,
  text: string,
) {
  const turn = get().turn;
  let reply = "";
  let onFinish: (() => Promise<void>) | null = null;

  if (turn === 0) {
    reply = "A few quick picks before I draft your paper:";
    await streamMessageLocal(set, reply, "clarifying");
    set((s) => ({
      messages: s.messages.map((m, i) =>
        i === s.messages.length - 1
          ? { ...m, intakeQuestions: defaultIntakeQuestions() }
          : m,
      ),
      turn: s.turn + 1,
      isStreaming: false,
    }));
    if (onFinish) await onFinish();
    return;
  }
  if (turn === 1) {
    reply = generatingReply;
    onFinish = async () => {
      await sleep(700);
      set({ paper: createSamplePaper(), mode: "paper" });
      await streamMessageLocal(set, generatedSummary, "updating");
    };
  } else {
    reply = followUpReplies[turn % followUpReplies.length];
    const lower = text.toLowerCase();
    if (get().paper && lower.includes("harder")) {
      set((s) => {
        if (!s.paper) return s;
        return {
          paper: {
            ...s.paper,
            difficulty: "hard",
            sections: s.paper.sections.map((sec) => ({
              ...sec,
              questions: sec.questions.map((q) => ({ ...q, difficulty: "hard" as const })),
            })),
          },
        };
      });
    }
  }

  const state = turn === 0 ? "clarifying" : turn === 1 ? "generating" : "updating";
  await streamMessageLocal(set, reply, state);
  set((s) => ({ turn: s.turn + 1, isStreaming: false }));
  if (onFinish) await onFinish();
}

export const usePaperStore = create<State & Actions>((set, get) => ({
  mode: "empty",
  paper: null,
  paperVersions: [],
  messages: defaultMessages(),
  isStreaming: false,
  turn: 0,
  lastUserMessage: null,
  chatError: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;

    const server = await loadSessionFromServer();
    if (server?.paper || (server?.messages && server.messages.length > 0)) {
      set({
        mode: server.paper ? "paper" : "empty",
        paper: server.paper,
        paperVersions: [],
        messages:
          server.messages.length > 0
            ? mapServerMessages(server.messages)
            : defaultMessages(),
        hydrated: true,
      });
      persist(get);
      return;
    }

    const saved = loadWorkspace();
    if (saved) {
      set({
        mode: saved.mode,
        paper: saved.paper,
        paperVersions: saved.paperVersions ?? [],
        messages: saved.messages.length > 0 ? saved.messages : defaultMessages(),
        turn: saved.turn,
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  clearChatError: () => set({ chatError: null }),

  markIntakeSubmitted: (messageId, selections) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId
          ? { ...m, intakeSubmitted: true, intakeSelections: selections }
          : m,
      ),
    }));
    persist(get);
  },

  resetEmpty: () => {
    clearWorkspaceStorage();
    resetPaperId();
    set({
      mode: "empty",
      paper: null,
      paperVersions: [],
      turn: 0,
      chatError: null,
      lastUserMessage: null,
      messages: defaultMessages(),
    });
    persist(get);
  },

  loadSample: () => {
    set({
      mode: "paper",
      paper: createSamplePaper(),
      turn: 2,
      chatError: null,
      messages: [
        { id: messageId(), role: "assistant", content: welcomeMessage, state: "welcome" },
        { id: messageId(), role: "assistant", content: generatedSummary, state: "updating" },
      ],
    });
    persist(get);
  },

  sendUserMessage: async (text, opts) => {
    if (!text.trim() || get().isStreaming) return;
    const trimmed = text.trim();
    const hidden = opts?.hidden === true;
    set((s) => ({
      messages: [
        ...s.messages,
        { id: messageId(), role: "user", content: trimmed, hidden },
      ],
      isStreaming: true,
      chatError: null,
      lastUserMessage: trimmed,
    }));

    if (aiClient.useMockAi) {
      try {
        await sendUserMessageMock(set, get, trimmed);
      } catch (err) {
        set({
          chatError: err instanceof Error ? err.message : "Something went wrong",
          isStreaming: false,
        });
      }
      persist(get);
      return;
    }

    const assistantId = messageId();
    const turn = get().turn;
    const state = turn === 0 ? "clarifying" : turn === 1 ? "generating" : "updating";
    set((s) => ({
      messages: [
        ...s.messages,
        { id: assistantId, role: "assistant", content: "", streaming: true, state },
      ],
    }));

    try {
      await aiClient.runChat({
        message: trimmed,
        messages: get().messages.filter((m) => m.id !== assistantId),
        paper: get().paper,
        turn: get().turn,
        versionHistory: versionHistoryForApi(get().paperVersions),
        onEvent: (ev) => {
          if (ev.type === "token") {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + ev.content, streaming: true }
                  : m,
              ),
            }));
          }
          if (ev.type === "intake") {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, intakeQuestions: ev.questions } : m,
              ),
            }));
          }
          if (ev.type === "paper") {
            applyCopilotPaperUpdate(set, get, ev.paper, "copilot");
          }
          if (ev.type === "revert") {
            const { paper, versions } = revertPaperVersions(get().paperVersions, ev.steps);
            if (paper) set({ paper, paperVersions: versions });
          }
          if (ev.type === "error") {
            set({
              chatError: ev.message,
              isStreaming: false,
              messages: get().messages.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      streaming: false,
                      state: "error",
                      content: m.content.replace(
                        /\n*Drafting your paper from syllabus-aligned topics…\n*/g,
                        "",
                      ),
                    }
                  : m,
              ),
            });
          }
          if (ev.type === "done") {
            set((s) => ({
              isStreaming: false,
              turn: ev.meta?.turn != null ? Number(ev.meta.turn) : s.turn + 1,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m,
              ),
            }));
          }
        },
      });
    } catch (err) {
      set({
        chatError: err instanceof Error ? err.message : "Failed to reach copilot",
        isStreaming: false,
        messages: get().messages.filter((m) => m.id !== assistantId),
      });
    }
    persist(get);
  },

  retryLastMessage: async () => {
    const last = get().lastUserMessage;
    if (!last) return;
    set((s) => ({
      messages: s.messages.filter((m) => m.state !== "error"),
      chatError: null,
    }));
    await get().sendUserMessage(last);
  },

  updateQuestion: (sectionId, questionId, patch) => {
    set((s) => mutateQuestion(s, sectionId, questionId, (q) => ({ ...q, ...patch })));
    persist(get);
  },

  deleteQuestion: (sectionId, questionId) => {
    set((s) => {
      if (!s.paper) return s;
      return {
        paper: {
          ...s.paper,
          sections: s.paper.sections.map((sec) =>
            sec.id === sectionId
              ? { ...sec, questions: sec.questions.filter((q) => q.id !== questionId) }
              : sec,
          ),
        },
      };
    });
    persist(get);
  },

  regenerateQuestion: async (sectionId, questionId) => {
    await regenerateQuestionCore(get, set, sectionId, questionId, { toastOnSuccess: true });
  },

  modifyQuestion: async (sectionId, questionId, prompt) => {
    const paper = get().paper;
    if (!paper) return false;
    const sec = paper.sections.find((s) => s.id === sectionId);
    const question = sec?.questions.find((q) => q.id === questionId);
    if (!question) return false;

    if (aiClient.useMockAi) {
      set((s) =>
        mutateQuestion(s, sectionId, questionId, (q) => {
          const fresh = generateQuestion({
            topic: q.topic,
            difficulty: q.difficulty,
            type: q.type,
            marks: q.marks,
          });
          const note = prompt.trim() ? ` (${prompt.trim()})` : "";
          return { ...fresh, id: q.id, text: fresh.text + note };
        }),
      );
      persist(get);
      return true;
    }

    try {
      const events = await aiClient.modifyQuestion({
        paper,
        sectionId,
        questionId,
        question,
        prompt,
        onEvent: () => {},
      });
      const err = events.find((e) => e.type === "error");
      if (err?.type === "error") {
        toast.error(err.message);
        return false;
      }
      const qEv = events.find((e) => e.type === "question");
      if (qEv?.type === "question") {
        set((s) => ({
          paperVersions: pushPaperVersion(
            s.paperVersions,
            paper,
            `Before modify: ${prompt.slice(0, 80)}`,
            "modify_panel",
          ),
        }));
        set((s) => mutateQuestion(s, sectionId, questionId, () => qEv.question));
        persist(get);
        return true;
      }
      toast.error("Modify did not return an updated question");
      return false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modify failed");
      return false;
    }
  },

  addQuestion: async (sectionId, mode, opts) => {
    if (mode === "manual") {
      set((s) => addQuestionToSection(s, sectionId, opts, "manual"));
      persist(get);
      return;
    }
    const paper = get().paper;
    if (!paper) return;
    if (aiClient.useMockAi) {
      set((s) => addQuestionToSection(s, sectionId, opts, "ai"));
      persist(get);
      return;
    }
    try {
      const events = await aiClient.generateQuestion({
        paper,
        sectionId,
        trigger: "add_ai",
        topic: opts?.topic,
        difficulty: opts?.difficulty,
      });
      const err = events.find((e) => e.type === "error");
      if (err?.type === "error") {
        toast.error(err.message);
        return;
      }
      const qEv = events.find((e) => e.type === "question");
      if (qEv?.type === "question") {
        set((s) => ({
          paper: applyQuestionToPaper(s.paper!, sectionId, qEv.question),
        }));
      } else {
        toast.error("No question returned from AI");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add question");
    }
    persist(get);
  },

  insertQuestionAt: async (sectionId, index, mode, opts) => {
    if (mode === "manual") {
      set((s) => insertQuestionInSection(s, sectionId, index, opts, "manual"));
      persist(get);
      return;
    }
    const paper = get().paper;
    if (!paper) return;
    if (aiClient.useMockAi) {
      set((s) => insertQuestionInSection(s, sectionId, index, opts, "ai"));
      persist(get);
      return;
    }
    try {
      const events = await aiClient.generateQuestion({
        paper,
        sectionId,
        trigger: "insert_ai",
        topic: opts?.topic,
        difficulty: opts?.difficulty,
      });
      const err = events.find((e) => e.type === "error");
      if (err?.type === "error") {
        toast.error(err.message);
        return;
      }
      const qEv = events.find((e) => e.type === "question");
      if (qEv?.type === "question" && get().paper) {
        set((s) => {
          if (!s.paper) return s;
          const sec = s.paper.sections.find((x) => x.id === sectionId);
          if (!sec) return s;
          const next = [...sec.questions];
          next.splice(Math.max(0, Math.min(index, next.length)), 0, qEv.question);
          return {
            paper: {
              ...s.paper,
              sections: s.paper.sections.map((x) =>
                x.id === sectionId ? { ...x, questions: next } : x,
              ),
            },
          };
        });
      } else {
        toast.error("No question returned from AI");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to insert question");
    }
    persist(get);
  },

  reorderQuestion: (sectionId, from, to) => {
    set((s) => {
      if (!s.paper) return s;
      return {
        paper: {
          ...s.paper,
          sections: s.paper.sections.map((x) => {
            if (x.id !== sectionId) return x;
            if (from === to || from < 0 || from >= x.questions.length) return x;
            const next = [...x.questions];
            const [moved] = next.splice(from, 1);
            next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
            return { ...x, questions: next };
          }),
        },
      };
    });
    persist(get);
  },

  setDifficulty: async (sectionId, questionId, d) => {
    const sec = get().paper?.sections.find((s) => s.id === sectionId);
    const q = sec?.questions.find((x) => x.id === questionId);
    if (!q || q.difficulty === d) return;
    set((s) => mutateQuestion(s, sectionId, questionId, (qu) => ({ ...qu, difficulty: d })));
    persist(get);
    toast.loading("Regenerating at new difficulty…", { id: `regen-${questionId}` });
    const ok = await regenerateQuestionCore(get, set, sectionId, questionId, {
      skipVersion: false,
      toastOnSuccess: false,
    });
    toast.dismiss(`regen-${questionId}`);
    if (ok) toast.success(`Question updated to ${d}`);
    else toast.error("Could not regenerate question");
  },

  changeTopic: async (sectionId, questionId, topic) => {
    const sec = get().paper?.sections.find((s) => s.id === sectionId);
    const q = sec?.questions.find((x) => x.id === questionId);
    if (!q || q.topic === topic) return;
    set((s) => mutateQuestion(s, sectionId, questionId, (qu) => ({ ...qu, topic })));
    persist(get);
    toast.loading(`Regenerating for ${topic}…`, { id: `regen-${questionId}` });
    const ok = await regenerateQuestionCore(get, set, sectionId, questionId, {
      skipVersion: false,
      toastOnSuccess: false,
    });
    toast.dismiss(`regen-${questionId}`);
    if (ok) toast.success(`Question regenerated for ${topic}`);
    else toast.error("Could not regenerate question");
  },

  addConcepts: (sectionId, questionId) => {
    set((s) =>
      mutateQuestion(s, sectionId, questionId, (q) => ({
        ...q,
        text: q.text + " (Also test underlying concepts and edge cases.)",
      })),
    );
    persist(get);
  },

  changeType: async (sectionId, questionId, type) => {
    const sec = get().paper?.sections.find((s) => s.id === sectionId);
    const q = sec?.questions.find((x) => x.id === questionId);
    if (!q || q.type === type) return;

    if (type === "text") {
      set((s) =>
        mutateQuestion(s, sectionId, questionId, (qu) => ({
          ...qu,
          type: "text",
          options: undefined,
          correctOption: undefined,
        })),
      );
      persist(get);
      return;
    }

    set((s) =>
      mutateQuestion(s, sectionId, questionId, (qu) => ({
        ...qu,
        type: "mcq",
        options: ["", "", "", ""],
        correctOption: 0,
      })),
    );
    persist(get);

    toast.loading("Generating MCQ options…", { id: `mcq-${questionId}` });
    const ok = await get().modifyQuestion(
      sectionId,
      questionId,
      "Convert this to an MCQ. Keep the same topic, marks, and difficulty. Write a clear question stem and exactly 4 realistic, distinct answer options grounded in the syllabus — never use placeholders like Option A.",
    );
    toast.dismiss(`mcq-${questionId}`);
    if (ok) toast.success("Converted to MCQ");
  },

  updatePaperMeta: (patch) => {
    set((s) => (s.paper ? { paper: { ...s.paper, ...patch } } : s));
    persist(get);
  },

  setOverallDifficulty: (d) => {
    set((s) => {
      if (!s.paper) return s;
      return {
        paper: {
          ...s.paper,
          difficulty: d,
          sections: s.paper.sections.map((sec) => ({
            ...sec,
            questions: sec.questions.map((q) => ({ ...q, difficulty: d })),
          })),
        },
      };
    });
    persist(get);
  },

  applyOverallDifficulty: async (d) => {
    const paper = get().paper;
    if (!paper || paper.difficulty === d) return;

    set((s) => ({
      paperVersions: pushPaperVersion(
        s.paperVersions,
        paper,
        `Before difficulty → ${d}`,
        "manual",
      ),
      paper: {
        ...paper,
        difficulty: d,
        sections: paper.sections.map((sec) => ({
          ...sec,
          questions: sec.questions.map((q) => ({ ...q, difficulty: d })),
        })),
      },
    }));
    persist(get);

    const items = paper.sections.flatMap((sec) =>
      sec.questions.map((q) => ({ sectionId: sec.id, questionId: q.id })),
    );
    if (items.length === 0) return;

    toast.loading(`Updating all ${items.length} questions to ${d}…`, { id: "bulk-diff" });
    let failed = 0;
    for (const { sectionId, questionId } of items) {
      const ok = await regenerateQuestionCore(get, set, sectionId, questionId, {
        skipVersion: true,
        toastOnSuccess: false,
      });
      if (!ok) failed += 1;
    }
    toast.dismiss("bulk-diff");
    if (failed > 0) {
      toast.error(`${failed} question(s) could not be regenerated`);
    } else {
      toast.success(`Paper updated to ${d}`);
    }
    persist(get);
  },

  setSectionQuestionCount: (sectionId, count) => {
    set((s) => {
      if (!s.paper) return s;
      const next = Math.max(1, Math.min(50, Math.floor(count)));
      return {
        paper: {
          ...s.paper,
          sections: s.paper.sections.map((sec) => {
            if (sec.id !== sectionId) return sec;
            const cur = sec.questions.length;
            if (next === cur) return sec;
            if (next < cur) return { ...sec, questions: sec.questions.slice(0, next) };
            const last = sec.questions[cur - 1];
            const type = last?.type ?? "text";
            const marks = last?.marks ?? 1;
            const topic = last?.topic ?? s.paper!.topics[0] ?? "General";
            const diff = last?.difficulty ?? s.paper!.difficulty;
            const additions = Array.from({ length: next - cur }, () => ({
              ...blankQuestion(type, topic, marks),
              difficulty: diff,
            }));
            return { ...sec, questions: [...sec.questions, ...additions] };
          }),
        },
      };
    });
    persist(get);
  },

  setSectionTargetQuestions: (sectionId, count) => {
    set((s) => {
      if (!s.paper) return s;
      const n = Math.max(1, Math.min(99, Math.floor(count)));
      return {
        paper: {
          ...s.paper,
          sections: s.paper.sections.map((sec) =>
            sec.id === sectionId ? { ...sec, targetQuestions: n } : sec,
          ),
        },
      };
    });
    persist(get);
  },

  setSectionMarksPerQ: (sectionId, marks) => {
    set((s) => {
      if (!s.paper) return s;
      const m = Math.max(1, Math.min(20, Math.floor(marks)));
      return {
        paper: {
          ...s.paper,
          sections: s.paper.sections.map((sec) =>
            sec.id === sectionId
              ? {
                  ...sec,
                  instruction: syncInstructionMarks(sec.instruction, m),
                  questions: sec.questions.map((q) => ({ ...q, marks: m })),
                }
              : sec,
          ),
        },
      };
    });
    persist(get);
  },

  setTopicWeight: (topic, weight) => {
    set((s) => {
      if (!s.paper) return s;
      const target = Math.max(0, Math.min(100, Math.round(weight)));
      const topics = s.paper.topics;
      const current: Record<string, number> = topics.reduce(
        (acc, t) => {
          acc[t] = Math.round(s.paper!.topicWeights?.[t] ?? 100 / topics.length);
          return acc;
        },
        {} as Record<string, number>,
      );
      current[topic] = target;
      return { paper: { ...s.paper, topicWeights: current } };
    });
    persist(get);
  },

  setSectionTitle: (sectionId, title) => {
    set((s) => {
      if (!s.paper) return s;
      return {
        paper: {
          ...s.paper,
          sections: s.paper.sections.map((sec) => (sec.id === sectionId ? { ...sec, title } : sec)),
        },
      };
    });
    persist(get);
  },

  setSectionInstruction: (sectionId, instruction) => {
    set((s) => {
      if (!s.paper) return s;
      return {
        paper: {
          ...s.paper,
          sections: s.paper.sections.map((sec) =>
            sec.id === sectionId ? { ...sec, instruction } : sec,
          ),
        },
      };
    });
    persist(get);
  },

  addSection: () => {
    set((s) => {
      if (!s.paper) return s;
      const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
      const nextLetter = letters[s.paper.sections.length] ?? `${s.paper.sections.length + 1}`;
      const topic = s.paper.topics[0] ?? "General";
      const newSec: Section = {
        id: `sec_${Date.now().toString(36)}`,
        title: `Section ${nextLetter}`,
        instruction: "Answer the following questions.",
        questions: [
          { ...blankQuestion("text", topic, 3), difficulty: s.paper.difficulty },
        ],
      };
      return { paper: { ...s.paper, sections: [...s.paper.sections, newSec] } };
    });
    persist(get);
  },
}));

async function regenerateQuestionCore(
  get: () => State & Actions,
  set: (fn: (s: State) => Partial<State> | State) => void,
  sectionId: string,
  questionId: string,
  opts?: { skipVersion?: boolean; toastOnSuccess?: boolean },
): Promise<boolean> {
  const paper = get().paper;
  if (!paper) return false;
  const sec = paper.sections.find((s) => s.id === sectionId);
  const q = sec?.questions.find((x) => x.id === questionId);
  if (!q) return false;

  if (aiClient.useMockAi) {
    set((s) =>
      mutateQuestion(s, sectionId, questionId, (qu) => {
        const fresh = generateQuestion({
          topic: qu.topic,
          difficulty: qu.difficulty,
          type: qu.type,
          marks: qu.marks,
        });
        return { ...fresh, id: qu.id };
      }),
    );
    persist(get);
    if (opts?.toastOnSuccess) toast.success("Question regenerated");
    return true;
  }

  try {
    const events = await aiClient.generateQuestion({
      paper: get().paper!,
      sectionId,
      questionId,
      trigger: "regenerate",
    });
    const err = events.find((e) => e.type === "error");
    if (err?.type === "error") {
      if (opts?.toastOnSuccess) toast.error(err.message);
      return false;
    }
    const qEv = events.find((e) => e.type === "question");
    if (qEv?.type === "question") {
      if (!opts?.skipVersion) {
        set((s) => ({
          paperVersions: pushPaperVersion(
            s.paperVersions,
            get().paper!,
            `Before regenerate: ${q.topic}`,
            "modify_panel",
          ),
        }));
      }
      set((s) => mutateQuestion(s, sectionId, questionId, () => qEv.question));
      persist(get);
      if (opts?.toastOnSuccess) toast.success("Question regenerated");
      return true;
    }
    if (opts?.toastOnSuccess) toast.error("No question returned from AI");
    return false;
  } catch (err) {
    if (opts?.toastOnSuccess) {
      toast.error(err instanceof Error ? err.message : "Regenerate failed");
    }
    return false;
  }
}

function mutateQuestion(
  s: State,
  sectionId: string,
  questionId: string,
  fn: (q: Question) => Question,
): Partial<State> {
  if (!s.paper) return s;
  return {
    paper: {
      ...s.paper,
      sections: s.paper.sections.map(
        (sec): Section =>
          sec.id === sectionId
            ? { ...sec, questions: sec.questions.map((q) => (q.id === questionId ? fn(q) : q)) }
            : sec,
      ),
    },
  };
}

function addQuestionToSection(
  s: State,
  sectionId: string,
  opts: { topic?: string; difficulty?: Difficulty } | undefined,
  mode: "manual" | "ai",
): Partial<State> {
  if (!s.paper) return s;
  const sec = s.paper.sections.find((x) => x.id === sectionId);
  if (!sec) return s;
  const last = sec.questions[sec.questions.length - 1];
  const type: QuestionType = last?.type ?? "text";
  const marks = last?.marks ?? 3;
  const topic = opts?.topic ?? last?.topic ?? s.paper.topics[0] ?? "General";
  const difficulty = opts?.difficulty ?? last?.difficulty ?? s.paper.difficulty;
  const newQ =
    mode === "manual"
      ? { ...blankQuestion(type, topic, marks), difficulty }
      : generateQuestion({ topic, difficulty, type, marks });
  return {
    paper: {
      ...s.paper,
      sections: s.paper.sections.map((x) =>
        x.id === sectionId ? { ...x, questions: [...x.questions, newQ] } : x,
      ),
    },
  };
}

function insertQuestionInSection(
  s: State,
  sectionId: string,
  index: number,
  opts: { topic?: string; difficulty?: Difficulty } | undefined,
  mode: "manual" | "ai",
): Partial<State> {
  if (!s.paper) return s;
  const sec = s.paper.sections.find((x) => x.id === sectionId);
  if (!sec) return s;
  const ref = sec.questions[Math.min(index, sec.questions.length - 1)] ?? sec.questions[0];
  const type: QuestionType = ref?.type ?? "text";
  const marks = ref?.marks ?? 3;
  const topic = opts?.topic ?? ref?.topic ?? s.paper.topics[0] ?? "General";
  const difficulty = opts?.difficulty ?? ref?.difficulty ?? s.paper.difficulty;
  const newQ =
    mode === "manual"
      ? { ...blankQuestion(type, topic, marks), difficulty }
      : generateQuestion({ topic, difficulty, type, marks });
  return {
    paper: {
      ...s.paper,
      sections: s.paper.sections.map((x) => {
        if (x.id !== sectionId) return x;
        const next = [...x.questions];
        next.splice(Math.max(0, Math.min(index, next.length)), 0, newQ);
        return { ...x, questions: next };
      }),
    },
  };
}
