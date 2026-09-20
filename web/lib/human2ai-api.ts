import type { SpatialDraft, SpatialOperation } from "../../src/domain/spatial";
import type { SpatialRenderPass, SpatialBoxView } from "../../src/domain/spatial/types";
import type { DraftVersion } from "../../src/domain/session";
import type {
  CompositionDraft,
  CompositionRefinementResult,
} from "../../src/domain/composition";
import type {
  UiSketchDraft,
  UiSketchDraftVersion,
} from "../../src/domain/ui-sketch";
import type {
  StyleCategory,
  StyleEntry,
  SessionStyleState,
} from "../../src/domain/style";
import type { StyleProcessing } from "../../src/domain/session";

export type {
  StyleCategory,
  StyleCreatorType,
  StyleEntry,
  StyleReferenceImage,
  SessionStyleState,
} from "../../src/domain/style";

export interface Human2AiSession {
  id: string;
  projectId: string | null;
  styleId: string | null;
  sessionType: "image-composition" | "ui-layout" | "spatial";
  title: string;
  lifecycleStage: "draft" | "interpreted" | "approved" | "exported";
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface Human2AiProject {
  id: string;
  name: string;
  description: string | null;
  revision: number;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompositionDraftVersion {
  id: string;
  sessionId: string;
  revision: number;
  fingerprint: string;
  draft: CompositionDraft;
  createdAt: string;
  styleProcessing?: StyleProcessing;
}

export interface CompositionRefinementRun {
  id: string;
  sessionId: string;
  sourceDraftRevision: number;
  result: CompositionRefinementResult;
  createdAt: string;
}

export interface ImageAsset {
  id: string;
  sessionId: string;
  originalFilename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  byteSize: number;
  width: number;
  height: number;
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
  projectId: string | null = null,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiSession> {
  return requestJson(
    "/api/v1/sessions",
    {
      method: "POST",
      body: JSON.stringify({
        sessionType: "image-composition",
        title,
        ...(projectId ? { projectId } : {}),
      }),
    },
    fetcher,
  );
}

export function createUiSketchSession(
  title: string,
  projectId: string | null = null,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiSession> {
  return requestJson(
    "/api/v1/sessions",
    {
      method: "POST",
      body: JSON.stringify({
        sessionType: "ui-layout",
        title,
        ...(projectId ? { projectId } : {}),
      }),
    },
    fetcher,
  );
}

export async function listProjects(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiProject[]> {
  const payload = await requestJson<{ projects: Human2AiProject[] }>(
    "/api/v1/projects",
    {},
    fetcher,
  );
  return payload.projects;
}

export function createProject(
  name: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiProject> {
  return requestJson(
    "/api/v1/projects",
    { method: "POST", body: JSON.stringify({ name }) },
    fetcher,
  );
}

export function renameProject(
  projectId: string,
  name: string,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiProject> {
  return requestJson(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name, expectedRevision }),
    },
    fetcher,
  );
}

export async function deleteProject(
  projectId: string,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<void> {
  await requestResponse(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ expectedRevision }),
    },
    fetcher,
  );
}

export async function listSessions(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiSession[]> {
  const payload = await requestJson<{ sessions: Human2AiSession[] }>(
    "/api/v1/sessions",
    {},
    fetcher,
  );
  return payload.sessions;
}

export async function listStyles(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<StyleEntry[]> {
  const payload = await requestJson<{ styles: StyleEntry[] }>(
    "/api/v1/styles",
    {},
    fetcher,
  );
  return payload.styles;
}

export function createUserStyle(
  input: { name: string; category: StyleCategory; description: string; promptSummary?: string },
  fetcher: typeof fetch = globalThis.fetch,
): Promise<StyleEntry> {
  return requestJson(
    "/api/v1/styles",
    { method: "POST", body: JSON.stringify(input) },
    fetcher,
  );
}

export function updateStyle(
  styleId: string,
  input: {
    expectedRevision: number;
    name?: string;
    category?: StyleCategory;
    description?: string;
    promptSummary?: string;
  },
  fetcher: typeof fetch = globalThis.fetch,
): Promise<StyleEntry> {
  return requestJson(
    `/api/v1/styles/${encodeURIComponent(styleId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function deleteStyle(
  styleId: string,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<void> {
  await requestResponse(
    `/api/v1/styles/${encodeURIComponent(styleId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ expectedRevision }),
    },
    fetcher,
  );
}

export function uploadStyleReference(
  styleId: string,
  file: File,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<StyleEntry> {
  return requestJson(
    `/api/v1/styles/${encodeURIComponent(styleId)}/references?filename=${encodeURIComponent(file.name)}&expectedRevision=${expectedRevision}`,
    {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    },
    fetcher,
  );
}

export function deleteStyleReference(
  styleId: string,
  referenceId: string,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<StyleEntry> {
  return requestJson(
    `/api/v1/styles/${encodeURIComponent(styleId)}/references/${encodeURIComponent(referenceId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ expectedRevision }),
    },
    fetcher,
  );
}

export function styleReferenceContentUrl(
  styleId: string,
  referenceId: string,
): string {
  const pathname = `/api/v1/styles/${encodeURIComponent(styleId)}/references/${encodeURIComponent(referenceId)}/content`;
  return typeof globalThis.location === "undefined"
    ? pathname
    : new URL(pathname, globalThis.location.origin).toString();
}

export function getSessionStyle(
  sessionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<SessionStyleState> {
  return requestJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/style`, {}, fetcher);
}

export function bindSessionStyle(
  sessionId: string,
  styleId: string | null,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<SessionStyleState> {
  return requestJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/style`, {
    method: "PATCH", body: JSON.stringify({ styleId, expectedRevision }),
  }, fetcher);
}

export function moveSession(
  sessionId: string,
  projectId: string,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiSession> {
  return requestJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/project`,
    {
      method: "PATCH",
      body: JSON.stringify({ projectId, expectedRevision }),
    },
    fetcher,
  );
}

export function renameSession(
  sessionId: string,
  title: string,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<Human2AiSession> {
  return requestJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ title, expectedRevision }),
    },
    fetcher,
  );
}

export async function deleteSession(
  sessionId: string,
  expectedRevision: number,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<void> {
  await requestResponse(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ expectedRevision }),
    },
    fetcher,
  );
}

export async function listCompositionDrafts(
  sessionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CompositionDraftVersion[]> {
  return listDraftVersions(sessionId, "composition", fetcher);
}

export function saveCompositionDraft(
  sessionId: string,
  expectedLatestRevision: number,
  draft: CompositionDraft,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CompositionDraftVersion> {
  return saveDraftVersion(
    sessionId,
    "composition",
    expectedLatestRevision,
    draft,
    fetcher,
  );
}

export async function listUiSketchDrafts(
  sessionId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<UiSketchDraftVersion[]> {
  return listDraftVersions(sessionId, "ui-sketch", fetcher);
}

export function saveUiSketchDraft(
  sessionId: string,
  expectedLatestRevision: number,
  draft: UiSketchDraft,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<UiSketchDraftVersion> {
  return saveDraftVersion(
    sessionId,
    "ui-sketch",
    expectedLatestRevision,
    draft,
    fetcher,
  );
}

export function uploadImageAsset(
  sessionId: string,
  file: File,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<ImageAsset> {
  return requestJson(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/assets?filename=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    },
    fetcher,
  );
}

export function imageAssetContentUrl(sessionId: string, assetId: string): string {
  const pathname = `/api/v1/sessions/${encodeURIComponent(sessionId)}/assets/${encodeURIComponent(assetId)}/content`;
  return typeof globalThis.location === "undefined"
    ? pathname
    : new URL(pathname, globalThis.location.origin).toString();
}

export async function readImageFile(
  src: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<File> {
  const response = await fetcher(src);
  if (!response.ok) throw new Error(`Image content request failed: ${response.status}`);
  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const extension = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  }[type];
  if (!extension) throw new Error(`Unsupported image content type: ${type}`);
  return new File([await response.blob()], `image.${extension}`, { type });
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

type DraftRoute = "composition" | "ui-sketch" | "spatial";

async function listDraftVersions<TVersion>(
  sessionId: string,
  route: DraftRoute,
  fetcher: typeof fetch,
): Promise<TVersion[]> {
  const payload = await requestJson<{ draftVersions: TVersion[] }>(
    draftVersionsPath(sessionId, route),
    {},
    fetcher,
  );
  return payload.draftVersions;
}

function saveDraftVersion<TDraft, TVersion>(
  sessionId: string,
  route: DraftRoute,
  expectedLatestRevision: number,
  draft: TDraft,
  fetcher: typeof fetch,
): Promise<TVersion> {
  return requestJson(
    draftVersionsPath(sessionId, route),
    {
      method: "POST",
      body: JSON.stringify({ expectedLatestRevision, draft }),
    },
    fetcher,
  );
}

function draftVersionsPath(sessionId: string, route: DraftRoute): string {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/${route}/drafts`;
}

async function requestJson<T>(
  pathname: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<T> {
  const response = await requestResponse(pathname, init, fetcher);
  return (await readJson(response)) as T;
}

async function requestResponse(
  pathname: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<Response> {
  const response = await fetcher(pathname, {
    ...init,
    cache: "no-store",
    headers:
      init.body === undefined
        ? init.headers
        : init.headers ?? { "content-type": "application/json" },
  });
  if (!response.ok) {
    const payload = await readJson(response);
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
  return response;
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

export type SpatialDraftVersion = DraftVersion<SpatialDraft>;
export function createSpatialSession(title: string, projectId: string | null = null, fetcher: typeof fetch = globalThis.fetch): Promise<Human2AiSession> {
  return requestJson("/api/v1/sessions", { method: "POST", body: JSON.stringify({ sessionType: "spatial", title, projectId }) }, fetcher);
}
export function listSpatialDraftVersions(sessionId: string, fetcher: typeof fetch = globalThis.fetch): Promise<SpatialDraftVersion[]> {
  return listDraftVersions(sessionId, "spatial", fetcher);
}
export async function getLatestSpatialDraftVersion(sessionId: string, knownRevision = 0, fetcher: typeof fetch = globalThis.fetch): Promise<SpatialDraftVersion | null> {
  const payload = await requestJson<{ draftVersion: SpatialDraftVersion | null }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/drafts/latest?knownRevision=${knownRevision}`, {}, fetcher,
  );
  return payload.draftVersion;
}
export function saveSpatialDraft(sessionId: string, revision: number, draft: SpatialDraft, fetcher: typeof fetch = globalThis.fetch): Promise<SpatialDraftVersion> {
  return saveDraftVersion(sessionId, "spatial", revision, draft, fetcher);
}
export function undoSpatialDraft(sessionId: string, revision: number, fetcher: typeof fetch = globalThis.fetch): Promise<SpatialDraftVersion> {
  return requestJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/drafts/undo`, { method: "POST", body: JSON.stringify({ expectedLatestRevision: revision, changeRevision: revision }) }, fetcher);
}
export function restoreSpatialDraft(sessionId: string, revision: number, targetRevision: number, fetcher: typeof fetch = globalThis.fetch): Promise<SpatialDraftVersion> {
  return requestJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/drafts/restore`, { method: "POST", body: JSON.stringify({ expectedLatestRevision: revision, targetRevision }) }, fetcher);
}
export function spatialCameraUrl(sessionId: string, cameraId: string, revision?: number, pass: SpatialRenderPass = "color"): string {
  const query = new URLSearchParams();
  // Invalidate immutable camera previews when the model's visible detail changes.
  query.set("renderer", "8");
  if (revision) query.set("revision", String(revision));
  if (pass !== "color") query.set("pass", pass);
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/cameras/${encodeURIComponent(cameraId)}.png${query.size ? `?${query}` : ""}`;
}

export function spatialCameraBoxUrl(sessionId: string, boxId: string, revision: number, view: SpatialBoxView = "sheet", pass: SpatialRenderPass = "color"): string {
  const query = new URLSearchParams({ renderer: "4", revision: String(revision), view, pass });
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/camera-boxes/${encodeURIComponent(boxId)}.png?${query}`;
}

export function applySpatialEdits(sessionId: string, revision: number, operations: SpatialOperation[], fetcher: typeof fetch = globalThis.fetch): Promise<SpatialDraftVersion & { constrained: boolean }> {
  return requestJson(`/api/v1/sessions/${encodeURIComponent(sessionId)}/spatial/operations`, { method: "POST", body: JSON.stringify({ expectedLatestRevision: revision, operations }) }, fetcher);
}
