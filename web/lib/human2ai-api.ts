import type {
  CompositionDraft,
  CompositionRefinementResult,
} from "../../src/domain/composition";

export interface Human2AiSession {
  id: string;
  projectId: string | null;
  sessionType: "image-composition" | "ui-layout";
  title: string;
  revision: number;
}

export interface CompositionDraftVersion {
  id: string;
  sessionId: string;
  revision: number;
  fingerprint: string;
  draft: CompositionDraft;
  createdAt: string;
}

export interface CompositionRefinementRun {
  id: string;
  sessionId: string;
  sourceDraftRevision: number;
  result: CompositionRefinementResult;
  createdAt: string;
}

export class Human2AiApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "Human2AiApiError";
  }
}

export function getSession(
  sessionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiSession> {
  return requestJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}`, {}, fetcher);
}

export function createCompositionSession(
  title: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiSession> {
  return requestJson(
    "/api/v1/sessions",
    {
      method: "POST",
      body: JSON.stringify({ sessionType: "image-composition", title }),
    },
    fetcher,
  );
}

export async function listCompositionDrafts(
  sessionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CompositionDraftVersion[]> {
  const payload = await requestJson<{ draftVersions: CompositionDraftVersion[] }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/composition/drafts`,
    {},
    fetcher,
  );
  return payload.draftVersions;
}

export function saveCompositionDraft(
  sessionId: string,
  expectedLatestRevision: number,
  draft: CompositionDraft,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CompositionDraftVersion> {
  return requestJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/composition/drafts`,
    {
      method: "POST",
      body: JSON.stringify({ expectedLatestRevision, draft }),
    },
    fetcher,
  );
}

export async function listCompositionRefinements(
  sessionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CompositionRefinementRun[]> {
  const payload = await requestJson<{
    refinementRuns: CompositionRefinementRun[];
  }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/composition/refinements`,
    {},
    fetcher,
  );
  return payload.refinementRuns;
}

async function requestJson<T>(
  pathname: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<T> {
  const response = await fetcher(pathname, {
    ...init,
    cache: "no-store",
    headers:
      init.body === undefined ? init.headers : { "content-type": "application/json" },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = isRecord(payload) ? payload : {};
    throw new Human2AiApiError(
      typeof error.code === "string" ? error.code : `HTTP_${response.status}`,
      typeof error.message === "string"
        ? error.message
        : `Human2AI request failed with HTTP ${response.status}`,
      response.status,
      Object.fromEntries(
        Object.entries(error).filter(([key]) => key !== "code" && key !== "message"),
      ),
    );
  }
  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Human2AiApiError(
      "INVALID_SERVICE_RESPONSE",
      `Human2AI returned invalid JSON with HTTP ${response.status}`,
      response.status,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
