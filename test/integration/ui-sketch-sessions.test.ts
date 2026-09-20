import { resolve } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.js";
import {
  createUiSketchDraft,
  insertUiSketchStage,
  renameUiSketchState,
  reorderUiSketchStates,
  deleteUiSketchState,
  uiSketchDraftFingerprint,
  type UiSketchDraft,
} from "../../src/domain/ui-sketch/index.js";
import { buildServer } from "../../src/server/app.js";

const migrationsDirectory = resolve("migrations");

describe("UI sketch session API", () => {
  let database: DatabaseConnection | undefined;
  let server: FastifyInstance | undefined;

  afterEach(async () => {
    await server?.close();
    database?.close();
  });

  it("creates and lists revision-aware UI sketch drafts", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "ui-layout", "首页 UI 草图");
    const draft = createUiSketchDraft();
    draft.rectangles.push({
      id: "hero",
      x: 80,
      y: 100,
      width: 800,
      height: 240,
      note: "首屏主区域",
      annotation: "",
      semanticType: "主内容区",
      origin: "import",
      visible: true,
      weight: "high",
    });

    const created = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/ui-sketch/drafts`,
      payload: { expectedLatestRevision: 0, draft },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({
      revision: 1,
      fingerprint: uiSketchDraftFingerprint(draft),
      draft,
    });

    const conflict = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/ui-sketch/drafts`,
      payload: { expectedLatestRevision: 0, draft },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      code: "DRAFT_REVISION_CONFLICT",
      actualLatestRevision: 1,
    });

    const versions = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/ui-sketch/drafts`,
    });
    expect(
      versions.json<{
        draftVersions: Array<{ revision: number; fingerprint: string; draft: UiSketchDraft }>;
      }>()
        .draftVersions,
    ).toEqual([
      expect.objectContaining({
        revision: 1,
        fingerprint: uiSketchDraftFingerprint(draft),
        draft,
      }),
    ]);

    const changedDraft = structuredClone(draft);
    changedDraft.overallNote = "Agent 调整后的布局";
    const changed = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/ui-sketch/drafts`,
      payload: { expectedLatestRevision: 1, draft: changedDraft },
    });
    expect(changed.statusCode, changed.body).toBe(201);

    const undo = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/ui-sketch/drafts/undo`,
      payload: { changeRevision: 2, expectedLatestRevision: 2 },
    });
    expect(undo.statusCode, undo.body).toBe(201);
    expect(undo.json()).toMatchObject({ revision: 3, draft });
  });

  it("round-trips renamed, reordered and deleted states through draft versions", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "ui-layout", "状态管理");
    let draft = insertUiSketchStage(createUiSketchDraft(), "start", "second");
    draft = insertUiSketchStage(draft, "second", "third");
    draft = renameUiSketchState(draft, "second", "激活");
    draft = reorderUiSketchStates(draft, ["third", "second", "start"]);
    draft = deleteUiSketchState(draft, "start");
    const saved = await server.inject({
      method: "POST", url: `/api/v1/sessions/${sessionId}/ui-sketch/drafts`,
      payload: { expectedLatestRevision: 0, draft },
    });
    expect(saved.statusCode, saved.body).toBe(201);
    const versions = await server.inject({
      method: "GET", url: `/api/v1/sessions/${sessionId}/ui-sketch/drafts`,
    });
    expect(versions.json().draftVersions[0].draft).toEqual(draft);
  });

  it("rejects invalid drafts and composition sessions", async () => {
    ({ database, server } = createTestServer());
    const uiSessionId = await createSession(server, "ui-layout", "UI 草图");
    const compositionSessionId = await createSession(
      server,
      "image-composition",
      "构图",
    );

    const invalid = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${uiSessionId}/ui-sketch/drafts`,
      payload: {
        expectedLatestRevision: 0,
        draft: { ...createUiSketchDraft(), rectangles: [{ id: "broken" }] },
      },
    });
    expect(invalid.statusCode).toBe(400);

    const wrongType = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${compositionSessionId}/ui-sketch/drafts`,
    });
    expect(wrongType.statusCode).toBe(409);
    expect(wrongType.json()).toMatchObject({ code: "SESSION_TYPE_MISMATCH" });
  });

  function createTestServer(): {
    database: DatabaseConnection;
    server: FastifyInstance;
  } {
    const database = openDatabase(":memory:", migrationsDirectory);
    const projectSessions = new ProjectSessionRepository(database);
    const uiSketchSessions = new UiSketchSessionRepository(database);
    return {
      database,
      server: buildServer({}, { projectSessions, uiSketchSessions }),
    };
  }
});

async function createSession(
  server: FastifyInstance,
  sessionType: "image-composition" | "ui-layout",
  title: string,
): Promise<string> {
  const response = await server.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: { sessionType, title },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
}
