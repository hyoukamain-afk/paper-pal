import { llmTaskSchema } from "@/lib/schemas/task";
import { sseResponse } from "@/lib/streaming";
import { resolveAdminSecret, type CfEnv } from "@/server/env";
import { ingestCatalogBook, type IngestBookInput } from "@/server/ai/rag/catalog-ingest";
import { extractTextFromPdf } from "@/server/ai/rag/pdf-extract";
import { getOrchestratorEnv, runTask } from "@/server/ai/orchestrator";
import { getStorage } from "@/server/storage";
import type { StorageContext } from "@/server/storage/types";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function handleApiRequest(
  request: Request,
  cfEnv?: CfEnv,
  storage?: StorageContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  const store = storage ?? getStorage(cfEnv);

  try {
    if (url.pathname === "/api/ai/chat" && request.method === "POST") {
      return handleAiTask(request, "CHAT", cfEnv, store);
    }
    if (url.pathname === "/api/ai/paper" && request.method === "POST") {
      return handleAiTask(request, "GENERATE_PAPER", cfEnv, store);
    }
    if (url.pathname === "/api/ai/question/generate" && request.method === "POST") {
      return handleAiTask(request, "GENERATE_QUESTION", cfEnv, store);
    }
    if (url.pathname === "/api/ai/question/modify" && request.method === "POST") {
      return handleAiTask(request, "MODIFY_QUESTION", cfEnv, store);
    }
    if (url.pathname.startsWith("/api/ai/jobs/") && request.method === "GET") {
      const jobId = url.pathname.split("/").pop()!;
      const job = await store.postgres.getJob(jobId);
      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify(job), { headers: JSON_HEADERS });
    }
    if (url.pathname === "/api/admin/syllabus/ingest" && request.method === "POST") {
      return handleAdminSyllabusIngest(request, cfEnv, store);
    }
    if (url.pathname === "/api/session/load" && request.method === "GET") {
      return handleSessionLoad(request, store);
    }
    if (url.pathname === "/api/session/save" && request.method === "POST") {
      return handleSessionSave(request, store);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: JSON_HEADERS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "API error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: JSON_HEADERS });
  }
}

async function handleAiTask(
  request: Request,
  taskType: "CHAT" | "GENERATE_PAPER" | "GENERATE_QUESTION" | "MODIFY_QUESTION",
  cfEnv: CfEnv | undefined,
  storage: StorageContext,
): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;
  const task = { ...body, taskType };
  const parsed = llmTaskSchema.safeParse(task);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const orchEnv = getOrchestratorEnv(cfEnv);
  const accept = request.headers.get("Accept") ?? "";
  const wantsStream = accept.includes("text/event-stream") || body.stream === true;

  if (wantsStream) {
    return sseResponse(runTask(parsed.data, orchEnv, storage));
  }

  const events = [];
  for await (const e of runTask(parsed.data, orchEnv, storage)) events.push(e);
  return new Response(JSON.stringify({ events }), { headers: JSON_HEADERS });
}

type ParsedIngest = {
  input: IngestBookInput;
  pdfBytes?: Uint8Array;
};

async function parseIngestRequest(request: Request): Promise<ParsedIngest> {
  const contentType = request.headers.get("Content-Type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const pdf = form.get("pdf");
    if (!(pdf instanceof File)) {
      throw new Error("multipart ingest requires a pdf file field");
    }

    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
    const text = await extractTextFromPdf(pdfBytes);
    const topicsRaw = String(form.get("topics") ?? "[]");
    let topics: string[] = [];
    try {
      topics = JSON.parse(topicsRaw) as string[];
    } catch {
      topics = topicsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    }

    return {
      pdfBytes,
      input: {
        id: String(form.get("id") ?? ""),
        board: String(form.get("board") ?? "CBSE"),
        className: String(form.get("className") ?? ""),
        subject: String(form.get("subject") ?? ""),
        title: String(form.get("title") ?? ""),
        publisher: String(form.get("publisher") ?? "") || undefined,
        edition: String(form.get("edition") ?? "") || undefined,
        topics,
        r2Key: String(form.get("r2Key") ?? ""),
        text,
        filename: pdf.name,
      },
    };
  }

  if (contentType.includes("application/pdf")) {
    const url = new URL(request.url);
    const pdfBytes = new Uint8Array(await request.arrayBuffer());
    const text = await extractTextFromPdf(pdfBytes);
    const topicsRaw = url.searchParams.get("topics") ?? "[]";
    let topics: string[] = [];
    try {
      topics = JSON.parse(topicsRaw) as string[];
    } catch {
      topics = [];
    }

    return {
      pdfBytes,
      input: {
        id: url.searchParams.get("id") ?? "",
        board: url.searchParams.get("board") ?? "CBSE",
        className: url.searchParams.get("className") ?? "",
        subject: url.searchParams.get("subject") ?? "",
        title: url.searchParams.get("title") ?? "",
        publisher: url.searchParams.get("publisher") ?? undefined,
        edition: url.searchParams.get("edition") ?? undefined,
        topics,
        r2Key: url.searchParams.get("r2Key") ?? "",
        text,
        filename: url.searchParams.get("filename") ?? "upload.pdf",
      },
    };
  }

  const body = (await request.json()) as IngestBookInput & { pdfBase64?: string };
  if (body.pdfBase64) {
    const pdfBytes = Uint8Array.from(atob(body.pdfBase64), (c) => c.charCodeAt(0));
    const text = await extractTextFromPdf(pdfBytes);
    const { pdfBase64: _, ...rest } = body;
    return { pdfBytes, input: { ...rest, text } };
  }

  return { input: body };
}

async function handleAdminSyllabusIngest(
  request: Request,
  cfEnv: CfEnv | undefined,
  storage: StorageContext,
): Promise<Response> {
  const secret = request.headers.get("X-Admin-Secret");
  const expected = resolveAdminSecret(cfEnv);
  if (!secret || secret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  let parsed: ParsedIngest;
  try {
    parsed = await parseIngestRequest(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid ingest payload";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const { input, pdfBytes } = parsed;
  if (!input?.id || !input?.title || !input?.text) {
    return new Response(JSON.stringify({ error: "id, title, and text (or pdf) required" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (cfEnv?.SYLLABUS_BUCKET && input.r2Key) {
    if (pdfBytes) {
      await cfEnv.SYLLABUS_BUCKET.put(input.r2Key, pdfBytes, {
        httpMetadata: { contentType: "application/pdf" },
      });
    } else {
      await cfEnv.SYLLABUS_BUCKET.put(input.r2Key, input.text, {
        httpMetadata: { contentType: "text/plain; charset=utf-8" },
      });
    }
  }

  const book = await ingestCatalogBook(storage, input, cfEnv);
  return new Response(JSON.stringify({ book, status: "indexed" }), { headers: JSON_HEADERS });
}

async function handleSessionLoad(request: Request, storage: StorageContext): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const paperId = url.searchParams.get("paperId");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const messages = await storage.postgres.listChatMessages(sessionId, paperId ?? undefined);
  const paper = paperId ? await storage.postgres.getPaper(paperId) : null;

  return new Response(
    JSON.stringify({
      paper: paper?.data ?? null,
      messages,
    }),
    { headers: JSON_HEADERS },
  );
}

async function handleSessionSave(request: Request, storage: StorageContext): Promise<Response> {
  const body = (await request.json()) as {
    sessionId: string;
    paperId: string;
    paper?: unknown;
    messages?: Array<{ role: string; content: string; state?: string }>;
  };

  if (body.paper && body.paperId) {
    await storage.postgres.savePaper({
      id: body.paperId,
      sessionId: body.sessionId,
      version: Date.now(),
      data: body.paper as import("@/lib/types").Paper,
      updatedAt: new Date().toISOString(),
    });
  }

  if (body.messages) {
    for (const m of body.messages) {
      await storage.postgres.saveChatMessage({
        id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        sessionId: body.sessionId,
        paperId: body.paperId,
        role: m.role as "user" | "assistant",
        content: m.content,
        state: m.state,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
}
