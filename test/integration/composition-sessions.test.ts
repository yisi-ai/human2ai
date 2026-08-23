import { resolve } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import {
  addArea,
  addFocus,
  createDraft,
  draftFingerprint,
  moveItem,
  type CompositionDraft,
  type CompositionRefinementPlan,
} from "../../src/domain/composition/index.js";
import { buildServer } from "../../src/server/app.js";

const migrationsDirectory = resolve("migrations");

describe("composition session API", () => {
  let database: DatabaseConnection | undefined;
  let server: FastifyInstance | undefined;

  afterEach(async () => {
    await server?.close();
    database?.close();
  });

  it("persists immutable draft versions and Agent-authored refinement runs", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "image-composition", "主视觉构图");
    const firstDraft = createRefinableDraft();

    const firstVersionResponse = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
      payload: { expectedLatestRevision: 0, draft: firstDraft },
    });
    expect(firstVersionResponse.statusCode, firstVersionResponse.body).toBe(201);
    const firstVersion = firstVersionResponse.json<{
      id: string;
      revision: number;
      fingerprint: string;
      draft: CompositionDraft;
    }>();
    expect(firstVersion).toMatchObject({
      revision: 1,
      fingerprint: draftFingerprint(firstDraft),
      draft: firstDraft,
    });

    const secondDraft = moveItem(firstDraft, "focus-1", { x: 0.6, y: 0.4 });
    const secondVersionResponse = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
      payload: { expectedLatestRevision: 1, draft: secondDraft },
    });
    expect(secondVersionResponse.statusCode).toBe(201);
    expect(secondVersionResponse.json()).toMatchObject({ revision: 2, draft: secondDraft });

    const conflict = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
      payload: { expectedLatestRevision: 1, draft: secondDraft },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      code: "DRAFT_REVISION_CONFLICT",
      message: "Expected latest draft revision 1, received 2",
      expectedLatestRevision: 1,
      actualLatestRevision: 2,
    });

    const versions = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
    });
    expect(
      versions.json<{ draftVersions: Array<{ revision: number; draft: CompositionDraft }> }>()
        .draftVersions,
    ).toEqual([
      expect.objectContaining({ revision: 1, draft: firstDraft }),
      expect.objectContaining({ revision: 2, draft: secondDraft }),
    ]);

    const sessionResponse = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}`,
    });
    expect(sessionResponse.json()).toMatchObject({ revision: 1 });

    const plan = createRefinementPlan(firstDraft);
    const refinementResponse = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/refinements`,
      payload: { sourceDraftRevision: 1, plan },
    });
    expect(refinementResponse.statusCode, refinementResponse.body).toBe(201);
    const refinement = refinementResponse.json<{
      id: string;
      sourceDraftVersionId: string;
      sourceDraftRevision: number;
      sourceFingerprint: string;
      plan: CompositionRefinementPlan;
      result: { audit: { passed: boolean } };
    }>();
    expect(refinement).toMatchObject({
      sourceDraftVersionId: firstVersion.id,
      sourceDraftRevision: 1,
      sourceFingerprint: firstVersion.fingerprint,
      plan,
      result: { audit: { passed: true } },
    });

    const runs = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${sessionId}/composition/refinements`,
    });
    expect(runs.json<{ refinementRuns: Array<{ id: string }> }>().refinementRuns).toEqual([
      expect.objectContaining({ id: refinement.id }),
    ]);
    expect(database.prepare("SELECT count(*) AS count FROM composition_refinement_runs").get())
      .toEqual({ count: 1 });
  });

  it("rejects stale plans, wrong session types, and cross-session run access", async () => {
    ({ server, database } = createTestServer());
    const compositionId = await createSession(server, "image-composition", "构图 A");
    const otherCompositionId = await createSession(server, "image-composition", "构图 B");
    const uiSessionId = await createSession(server, "ui-layout", "界面布局");
    const draft = createRefinableDraft();
    await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${compositionId}/composition/drafts`,
      payload: { expectedLatestRevision: 0, draft },
    });

    const stalePlan = {
      ...createRefinementPlan(draft),
      sourceFingerprint: "draft-00000000",
    };
    const stale = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${compositionId}/composition/refinements`,
      payload: { sourceDraftRevision: 1, plan: stalePlan },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      code: "REFINEMENT_PLAN_STALE",
      expectedSourceFingerprint: draftFingerprint(draft),
      receivedSourceFingerprint: "draft-00000000",
    });

    const applied = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${compositionId}/composition/refinements`,
      payload: { sourceDraftRevision: 1, plan: createRefinementPlan(draft) },
    });
    const runId = applied.json<{ id: string }>().id;
    const crossSession = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${otherCompositionId}/composition/refinements/${runId}`,
    });
    expect(crossSession.statusCode).toBe(404);
    expect(crossSession.json()).toMatchObject({ code: "REFINEMENT_RUN_NOT_FOUND" });

    const wrongType = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${uiSessionId}/composition/drafts`,
    });
    expect(wrongType.statusCode).toBe(409);
    expect(wrongType.json()).toMatchObject({ code: "SESSION_TYPE_MISMATCH" });

    const missingDraft = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${otherCompositionId}/composition/refinements`,
      payload: { sourceDraftRevision: 1, plan: createRefinementPlan(draft) },
    });
    expect(missingDraft.statusCode).toBe(404);
    expect(missingDraft.json()).toMatchObject({ code: "DRAFT_VERSION_NOT_FOUND" });
  });

  function createTestServer(): {
    database: DatabaseConnection;
    server: FastifyInstance;
  } {
    const database = openDatabase(":memory:", migrationsDirectory);
    const compositionSessions = new CompositionSessionRepository(database);
    const projectSessions = new ProjectSessionRepository(database);
    return {
      database,
      server: buildServer({}, { compositionSessions, projectSessions }),
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

function createRefinableDraft(): CompositionDraft {
  let draft = addFocus(createDraft(), { x: 0.61, y: 0.39 }).draft;
  draft = addArea(draft, {
    primitive: "quadrilateral",
    aspect: "free",
    area: 0.1,
    x: 0.5,
    y: 0.5,
    rotation: 2,
  }).draft;
  return draft;
}

function createRefinementPlan(draft: CompositionDraft): CompositionRefinementPlan {
  return {
    version: 1,
    kind: "composition-refinement-plan",
    sourceFingerprint: draftFingerprint(draft),
    rationale: "Agent chooses a golden-section focus and horizontal mass axis.",
    operations: [
      {
        method: "focus-anchor",
        methodVersion: 1,
        targetFocusId: "focus-1",
        anchor: "golden-right-upper",
        strength: "subtle",
      },
      {
        method: "rotation-alignment",
        methodVersion: 1,
        targetAreaIds: ["area-1"],
        axis: "horizontal",
        strength: "subtle",
      },
    ],
  };
}
