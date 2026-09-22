import { resolve } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import {
  addArea,
  addCompositionPlan,
  replaceCompositionPlan,
  addFocus,
  addTextRegion,
  createDraft,
  changeFrame,
  createCompositionState,
  selectCompositionState,
  renameCompositionState,
  reorderCompositionStates,
  deleteCompositionState,
  draftFingerprint,
  moveFrame,
  moveItem,
  moveTextRegionCorner,
  setProcessingSemantic,
  updateAreaMetadata,
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

  it("round-trips human and Agent planning edits through existing revisions, conflicts and undo", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "image-composition", "Planning");
    let first = addCompositionPlan(createRefinableDraft(), "triangle").draft;
    for (const type of ["golden-section", "symmetry", "golden-spiral"] as const) {
      first = addCompositionPlan(first, type).draft;
    }
    first = createCompositionState(first, "state-1", "second");
    const url = `/api/v1/sessions/${sessionId}/composition/drafts`;
    const saved = await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 0, draft: first } });
    expect(saved.statusCode, saved.body).toBe(201);
    const second = replaceCompositionPlan(first, { ...first.plans![0], visible: false });
    const updated = await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 1, draft: second } });
    expect(updated.statusCode, updated.body).toBe(201);
    expect(updated.json().draft.plans).toEqual(second.plans);
    expect(updated.json().draft.areas).toEqual(first.areas);
    const stale = await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 1, draft: first } });
    expect(stale.statusCode).toBe(409);
    const restored = await server.inject({ method: "POST", url: `${url}/undo`, payload: { changeRevision: 2, expectedLatestRevision: 2 } });
    expect(restored.statusCode, restored.body).toBe(201);
    expect(restored.json().draft.plans).toEqual(first.plans);
    const loaded = await server.inject({ method: "GET", url });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.body).toContain('"triangle"');
  });

  it("saves shared nodes and independent named layouts, and restores them through draft undo", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "image-composition", "构图状态");
    let draft = createCompositionState(createRefinableDraft(), "state-1", "portrait");
    draft = changeFrame(draft, { width: 900, height: 1600 });
    draft = moveItem(draft, "area-1", { x: 0.7, y: 0.8 });
    draft = renameCompositionState(draft, "portrait", "竖版");
    draft = reorderCompositionStates(draft, ["portrait", "state-1"]);
    const saved = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
      payload: { expectedLatestRevision: 0, draft } });
    expect(saved.statusCode, saved.body).toBe(201);
    const loaded = await server.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}/composition/drafts` });
    expect(loaded.statusCode, loaded.body).toBe(200);
    const repository = new CompositionSessionRepository(database);
    const restored = repository.getDraftVersion(sessionId, 1).draft;
    expect(loaded.json().draftVersions[0].draft).toEqual(JSON.parse(JSON.stringify(restored)));
    expect(saved.json().draft).toEqual(JSON.parse(JSON.stringify(restored)));
    expect(restored.activeStateId).toBe("portrait");
    expect(restored.states?.map(({ id, name }) => ({ id, name })))
      .toEqual([{ id: "portrait", name: "竖版" }, { id: "state-1", name: undefined }]);
    expect(restored.frame).toEqual(draft.frame);
    expect(restored.areas[0]).toMatchObject({ x: 0.7, y: 0.8 });
    expect(selectCompositionState(restored, "state-1").frame).toEqual(createRefinableDraft().frame);
    const removed = deleteCompositionState(restored, "portrait");
    const deletion = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
      payload: { expectedLatestRevision: 1, draft: removed } });
    expect(deletion.statusCode, deletion.body).toBe(201);
    const undo = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts/undo`,
      payload: { changeRevision: 2, expectedLatestRevision: 2 } });
    expect(undo.statusCode, undo.body).toBe(201);
    expect(repository.getDraftVersion(sessionId, 3).draft).toEqual(restored);
  });

  it("saves text outlines and restores the rectangular draft on undo", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "image-composition", "文字轮廓");
    const original = addTextRegion(createDraft()).draft;
    const repository = new CompositionSessionRepository(database);
    repository.createDraftVersion(sessionId, { expectedLatestRevision: 0, draft: original });
    const edited = moveTextRegionCorner(original, "area-1", 0, { x: 0.42, y: 0.4 });
    const saved = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
      payload: { expectedLatestRevision: 1, draft: edited } });
    expect(saved.statusCode, saved.body).toBe(201);
    const restored = repository.getDraftVersion(sessionId, 2).draft;
    expect(restored.areas[0].corners).toHaveLength(4);
    expect(restored).toEqual(edited);
    const loaded = await server.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}/composition/drafts` });
    expect(loaded.json().draftVersions.some((version: { draft: CompositionDraft }) =>
      JSON.stringify(version.draft.areas[0].corners) === JSON.stringify(edited.areas[0].corners))).toBe(true);
    const undo = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts/undo`,
      payload: { changeRevision: 2, expectedLatestRevision: 2 } });
    expect(undo.statusCode, undo.body).toBe(201);
    expect(undo.json().draft).toEqual(original);
  });

  it("persists light source toggles and restores the original flag on undo", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "image-composition", "光源编辑");
    const original = createRefinableDraft();
    const repository = new CompositionSessionRepository(database);
    repository.createDraftVersion(sessionId, { expectedLatestRevision: 0, draft: original });
    const light = updateAreaMetadata(original, "area-1", { isLightSource: true });
    const saved = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts`,
      payload: { expectedLatestRevision: 1, draft: light } });
    expect(saved.statusCode, saved.body).toBe(201);
    expect(repository.getDraftVersion(sessionId, 2).draft).toEqual(light);
    expect(repository.getDraftVersion(sessionId, 1).draft).toEqual(original);
    const undo = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts/undo`,
      payload: { changeRevision: 2, expectedLatestRevision: 2 } });
    expect(undo.statusCode, undo.body).toBe(201);
    expect(undo.json()).toMatchObject({ revision: 3, draft: original });
  });

  it("persists directed plans and relation checks without writing a new source revision", async () => {
    ({ database, server } = createTestServer());
    const sessionId = await createSession(server, "image-composition", "规则精修");
    const draft = createRefinableDraft();
    const repository = new CompositionSessionRepository(database);
    repository.createDraftVersion(sessionId, { expectedLatestRevision: 0, draft });
    const plan = {
      version: 2, kind: "composition-refinement-plan", sourceFingerprint: draftFingerprint(draft),
      decision: "refine", objective: "Place the subject on a golden division.",
      assessment: { intent: "A single subject.", observations: ["Its center is unrelated to the selected division."], uncertainties: [] },
      preserve: ["Keep the subject content."], tradeoffs: [], rationale: "Use one relevant relationship.",
      fixedIds: [], focusLinks: [], operations: [{ method: "frame-placement", methodVersion: 1,
        targetId: "area-1", axis: "x", alignment: "center", division: "golden-end",
        reason: "The subject placement needs a deliberate anchor.", expectedEffect: "Establish a golden division." }],
    };
    const response = await server.inject({ method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/refinements`, payload: { sourceDraftRevision: 1, plan } });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().plan).toEqual(plan);
    expect(response.json().result.audit.relations[0]).toMatchObject({ passed: true, method: "frame-placement" });
    const list = await server.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}/composition/refinements` });
    expect(list.json().refinementRuns[0].result.audit.relations).toEqual(response.json().result.audit.relations);
    expect(repository.listDraftVersions(sessionId)).toHaveLength(1);
    expect(repository.getDraftVersion(sessionId, 1).draft).toEqual(draft);
    const retained = await server.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/composition/refinements`,
      payload: { sourceDraftRevision: 1, plan: { ...plan, decision: "retain", operations: [] } } });
    expect(retained.statusCode, retained.body).toBe(201);
    expect(retained.json().result.refinedDraft).toEqual(draft);
    const conflict = await server.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/composition/refinements`,
      payload: { sourceDraftRevision: 1, plan: { ...plan, operations: [plan.operations[0], { ...plan.operations[0], division: "center" }] } } });
    expect(conflict.statusCode, conflict.body).toBe(422);
    expect(conflict.json().audit.relations[0].passed).toBe(false);
    expect(repository.listRefinementRuns(sessionId)).toHaveLength(2);
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

    const unavailableUndo = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts/undo`,
      payload: { changeRevision: 1, expectedLatestRevision: 1 },
    });
    expect(unavailableUndo.statusCode).toBe(409);
    expect(unavailableUndo.json()).toMatchObject({
      code: "DRAFT_UNDO_UNAVAILABLE",
      changeRevision: 1,
    });

    const secondDraft = moveFrame(
      moveItem(firstDraft, "focus-1", { x: -0.6, y: -0.4 }),
      { x: -0.2, y: -0.1 },
    );
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

    const undo = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts/undo`,
      payload: { changeRevision: 2, expectedLatestRevision: 2 },
    });
    expect(undo.statusCode, undo.body).toBe(201);
    expect(undo.json()).toMatchObject({ revision: 3, draft: firstDraft });

    const staleUndo = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/composition/drafts/undo`,
      payload: { changeRevision: 2, expectedLatestRevision: 2 },
    });
    expect(staleUndo.statusCode).toBe(409);
    expect(staleUndo.json()).toMatchObject({
      code: "DRAFT_REVISION_CONFLICT",
      actualLatestRevision: 3,
    });

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
  let draft = addFocus(
    setProcessingSemantic(createDraft(), "scene-composition"),
    { x: 0.61, y: 0.39 },
  ).draft;
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
