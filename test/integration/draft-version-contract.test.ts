import { SpatialSessionRepository } from "../../src/database/spatial-session-repository.js";
import { createSpatialDraft, createHumanoid, spatialDraftFingerprint, validateSpatialDraft } from "../../src/domain/spatial/index.js";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerDraftVersionRoutes } from "../../src/server/routes/draft-version-routes.js";

import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.js";
import {
  addArea,
  createDraft,
  draftFingerprint,
  setProcessingSemantic,
  validateDraft,
} from "../../src/domain/composition/index.js";
import type {
  DraftVersionOperations,
  SessionType,
} from "../../src/domain/session/index.js";
import {
  createUiSketchDraft,
  uiSketchDraftFingerprint,
  validateUiSketchDraft,
} from "../../src/domain/ui-sketch/index.js";
import { registeredCapability } from "../helpers/domain-baseline.js";

const migrationsDirectory = resolve("migrations");

interface DraftVersionHarness {
  name: string;
  sessionType: SessionType;
  otherSessionType: SessionType;
  createRepository(database: DatabaseConnection): DraftVersionOperations<unknown>;
  createInitialDraft(): unknown;
  createChangedDraft(): unknown;
  createLegacyDraft(): unknown;
  normalizeDraft(draft: unknown): unknown;
  fingerprint(draft: unknown): string;
}

const harnesses: DraftVersionHarness[] = [
  {
    name: "3D space", sessionType: "spatial", otherSessionType: "image-composition",
    createRepository: database => new SpatialSessionRepository(database),
    createInitialDraft: createSpatialDraft,
    createChangedDraft: () => ({ ...createSpatialDraft(), characters: [createHumanoid("person", "Person")] }),
    createLegacyDraft: createSpatialDraft,
    normalizeDraft: validateSpatialDraft,
    fingerprint: spatialDraftFingerprint,
  },
  {
    name: "composition",
    sessionType: "image-composition",
    otherSessionType: "ui-layout",
    createRepository: (database) => new CompositionSessionRepository(database),
    createInitialDraft: createDraft,
    createChangedDraft: () =>
      setProcessingSemantic(createDraft(), "scene-composition"),
    createLegacyDraft: () => ({
      version: 1,
      kind: "composition-draft",
      frame: { width: 1200, height: 800 },
      focusPoints: [],
      directionLine: null,
      areas: [],
    }),
    normalizeDraft: validateDraft,
    fingerprint: draftFingerprint,
  },
  {
    name: "UI sketch",
    sessionType: "ui-layout",
    otherSessionType: "image-composition",
    createRepository: (database) => new UiSketchSessionRepository(database),
    createInitialDraft: createUiSketchDraft,
    createChangedDraft: () => ({
      ...createUiSketchDraft(),
      overallNote: "changed",
    }),
    createLegacyDraft: () => ({
      ...createUiSketchDraft(),
      rectangles: [
        { id: "panel", x: 10, y: 20, width: 300, height: 180 },
      ],
    }),
    normalizeDraft: validateUiSketchDraft,
    fingerprint: uiSketchDraftFingerprint,
  },
];

it("covers every registered draft version consumer", () => {
  const capability = registeredCapability("capture.draft-versioning");
  expect(harnesses.map(({ sessionType }) => sessionType).sort()).toEqual(capability.consumers);
});

describe.each(harnesses)("$name draft version contract", (harness) => {
  it("restores a specified historical revision for repeated undo and redo with concurrency checks", async () => {
    const database = openDatabase(":memory:", migrationsDirectory), server = Fastify();
    try {
      const sessionId = createSession(database, harness.sessionType);
      const repository = harness.createRepository(database);
      registerDraftVersionRoutes(server, { routePrefix: "/sessions/:sessionId", draftSchema: {}, repository });
      const first = repository.createDraftVersion(sessionId, { expectedLatestRevision: 0, draft: harness.createInitialDraft() });
      const second = repository.createDraftVersion(sessionId, { expectedLatestRevision: 1, draft: harness.createChangedDraft() });
      const restore = (targetRevision: number, expectedLatestRevision: number) => server.inject({
        method: "POST", url: `/sessions/${sessionId}/drafts/restore`, payload: { targetRevision, expectedLatestRevision },
      });
      expect((await restore(1, 2)).json()).toMatchObject({ revision: 3, draft: first.draft });
      expect((await restore(2, 3)).json()).toMatchObject({ revision: 4, draft: second.draft });
      expect((await restore(1, 4)).json()).toMatchObject({ revision: 5, draft: first.draft });
      expect((await restore(2, 4)).statusCode).toBe(409);
      expect((await restore(0, 5)).statusCode).toBe(400);
      expect((await restore(99, 5)).statusCode).toBe(404);
      expect(repository.listDraftVersions(sessionId).map(v => v.revision)).toEqual([1, 2, 3, 4, 5]);
    } finally { await server.close(); database.close(); }
  });

  it("reads only the latest revision and omits unchanged drafts without loading history", async () => {
    const database = openDatabase(":memory:", migrationsDirectory), server = Fastify();
    try {
      const sessionId = createSession(database, harness.sessionType);
      const wrongType = createSession(database, harness.otherSessionType);
      const repository = harness.createRepository(database);
      registerDraftVersionRoutes(server, { routePrefix: "/sessions/:sessionId", draftSchema: {}, repository });
      const url = `/sessions/${sessionId}/drafts/latest`;
      expect((await server.inject(url)).json()).toEqual({ draftVersion: null });
      const first = repository.createDraftVersion(sessionId, { expectedLatestRevision: 0, draft: harness.createInitialDraft() });
      const latest = repository.createDraftVersion(sessionId, { expectedLatestRevision: 1, draft: harness.createChangedDraft() });
      const history = vi.spyOn(repository, "listDraftVersions").mockImplementation(() => { throw new Error("History must not be loaded for synchronization"); });
      expect(repository.getLatestDraftVersion(sessionId, 1)).toEqual(latest);
      const changed = await server.inject(`${url}?knownRevision=1`);
      expect(changed.statusCode).toBe(200);
      expect(changed.json()).toEqual({ draftVersion: latest });
      expect(changed.headers["cache-control"]).toBe("no-store");
      expect((await server.inject(`${url}?knownRevision=2`)).json()).toEqual({ draftVersion: null });
      expect((await server.inject(`${url}?knownRevision=999`)).json()).toEqual({ draftVersion: latest });
      expect((await server.inject(`${url}?knownRevision=-1`)).statusCode).toBe(400);
      expect((await server.inject("/sessions/missing/drafts/latest")).statusCode).toBe(404);
      expect((await server.inject(`/sessions/${wrongType}/drafts/latest`)).statusCode).toBe(409);
      expect(history).not.toHaveBeenCalled();
      history.mockRestore();
      expect(repository.listDraftVersions(sessionId)).toEqual([first, latest]);
      const restored = repository.undoDraftVersion(sessionId, { changeRevision: 2, expectedLatestRevision: 2 });
      expect((await server.inject(`${url}?knownRevision=2`)).json()).toEqual({ draftVersion: restored });
    } finally { await server.close(); database.close(); }
  });

  it("keeps an append-only history and restores by appending a new revision", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    try {
      const sessionId = createSession(database, harness.sessionType);
      const repository = harness.createRepository(database);
      const first = repository.createDraftVersion(sessionId, {
        expectedLatestRevision: 0,
        draft: harness.createInitialDraft(),
      });
      const second = repository.createDraftVersion(sessionId, {
        expectedLatestRevision: 1,
        draft: harness.createChangedDraft(),
      });

      expect(first).toMatchObject({ sessionId, revision: 1 });
      expect(second).toMatchObject({ sessionId, revision: 2 });
      expect(repository.listDraftVersions(sessionId).map(({ revision }) => revision))
        .toEqual([1, 2]);
      expect(repository.getDraftVersion(sessionId, 1)).toEqual(first);
      expect(captureError(() => repository.createDraftVersion(sessionId, {
        expectedLatestRevision: 1,
        draft: harness.createChangedDraft(),
      }))).toMatchObject({
        code: "DRAFT_REVISION_CONFLICT",
        expectedLatestRevision: 1,
        actualLatestRevision: 2,
      });

      const restored = repository.undoDraftVersion(sessionId, {
        changeRevision: 2,
        expectedLatestRevision: 2,
      });
      expect(restored).toMatchObject({ revision: 3, draft: first.draft });
      expect(repository.listDraftVersions(sessionId).map(({ revision }) => revision))
        .toEqual([1, 2, 3]);
      expect(repository.getDraftVersion(sessionId, 1)).toEqual(first);
      expect(captureError(() => repository.undoDraftVersion(sessionId, {
        changeRevision: 2,
        expectedLatestRevision: 2,
      }))).toMatchObject({
        code: "DRAFT_REVISION_CONFLICT",
        actualLatestRevision: 3,
      });
    } finally {
      database.close();
    }
  });

  it.skipIf(harness.sessionType === "spatial")("saves layer-only changes and restores the previous order on undo", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    try {
      const sessionId = createSession(database, harness.sessionType);
      const repository = harness.createRepository(database);
      const draft = harness.sessionType === "image-composition"
        ? addArea(addArea(createDraft(), { primitive: "circle", area: 0.1 }).draft, { primitive: "circle", area: 0.1 }).draft
        : validateUiSketchDraft({ ...createUiSketchDraft(), rectangles: [
            { id: "area-1", x: 10, y: 10, width: 100, height: 100 },
            { id: "area-2", x: 20, y: 20, width: 100, height: 100 },
          ] });
      const initial = { ...draft, layerOrder: ["area-1", "area-2"] };
      repository.createDraftVersion(sessionId, { expectedLatestRevision: 0, draft: initial });
      const changed = { ...draft, layerOrder: ["area-2", "area-1"] };
      repository.createDraftVersion(sessionId, { expectedLatestRevision: 1, draft: changed });
      expect(repository.getDraftVersion(sessionId, 2)?.draft).toEqual(changed);
      expect(harness.fingerprint(changed)).not.toBe(harness.fingerprint(initial));
      expect(repository.undoDraftVersion(sessionId, { changeRevision: 2, expectedLatestRevision: 2 }))
        .toMatchObject({ revision: 3, draft: initial });
    } finally {
      database.close();
    }
  });

  it("enforces session, revision, and undo boundaries", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    try {
      const sessionId = createSession(database, harness.sessionType);
      const wrongTypeSessionId = createSession(database, harness.otherSessionType);
      const repository = harness.createRepository(database);

      expect(captureError(() => repository.listDraftVersions("missing")))
        .toMatchObject({ code: "SESSION_NOT_FOUND" });
      expect(captureError(() => repository.listDraftVersions(wrongTypeSessionId)))
        .toMatchObject({ code: "SESSION_TYPE_MISMATCH" });

      repository.createDraftVersion(sessionId, {
        expectedLatestRevision: 0,
        draft: harness.createInitialDraft(),
      });
      expect(captureError(() => repository.getDraftVersion(sessionId, 2)))
        .toMatchObject({ code: "DRAFT_VERSION_NOT_FOUND" });
      expect(captureError(() => repository.undoDraftVersion(sessionId, {
        changeRevision: 1,
        expectedLatestRevision: 1,
      }))).toMatchObject({ code: "DRAFT_UNDO_UNAVAILABLE", changeRevision: 1 });
      expect(captureError(() => repository.undoDraftVersion(sessionId, {
        changeRevision: 1,
        expectedLatestRevision: 2,
      }))).toMatchObject({ code: "INVALID_RECORD" });
    } finally {
      database.close();
    }
  });

  it("fingerprints the validated and normalized draft", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    try {
      const sessionId = createSession(database, harness.sessionType);
      const repository = harness.createRepository(database);
      const input = harness.createLegacyDraft();
      const normalized = harness.normalizeDraft(input);

      const version = repository.createDraftVersion(sessionId, {
        expectedLatestRevision: 0,
        draft: input,
      });

      expect(version.draft).toEqual(normalized);
      expect(version.fingerprint).toBe(harness.fingerprint(normalized));
    } finally {
      database.close();
    }
  });
});

function createSession(database: DatabaseConnection, sessionType: SessionType): string {
  return new ProjectSessionRepository(database).createSession({
    sessionType,
    title: `${sessionType} contract`,
  }).id;
}

function captureError(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to throw");
}
