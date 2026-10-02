import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.ts";
import { WorkspaceSettingsRepository } from "../../src/database/workspace-settings-repository.ts";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.ts";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.ts";
import { ImageAssetRepository } from "../../src/database/image-asset-repository.ts";
import { SessionStorageRepository } from "../../src/database/session-storage-repository.ts";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";
import { SESSION_TYPES } from "../../src/domain/session/types.ts";
import { buildServer } from "../../src/server/app.ts";

const day = 86_400_000;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
let database: DatabaseConnection, directory: string;
afterEach(async () => { database?.close(); if (directory) await rm(directory, { recursive: true, force: true }); });
async function fixture() {
  directory = await mkdtemp(join(tmpdir(), "h2a-settings-"));
  database = openDatabase(join(directory, "test.db"), resolve("migrations"));
  let now = Date.now();
  const projects = new ProjectSessionRepository(database, () => now);
  const settings = new WorkspaceSettingsRepository(database);
  const versions = new UiSketchSessionRepository(database);
  const assets = new ImageAssetRepository(database, join(directory, "artifacts"));
  const storage = new SessionStorageRepository(database, assets, join(directory, "artifacts"), () => now);
  return { projects, settings, versions, assets, storage, advance: (days: number) => { now += days * day; } };
}

it("persists retention settings, validates days and rejects concurrent overwrites", async () => {
  const f = await fixture();
  const server = buildServer({}, { settings: f.settings, projectSessions: f.projects });
  try {
    const initial = (await server.inject("/api/v1/settings")).json();
    expect(initial).toEqual({ revision: 1, imageRetentionDays: 1, historyRetentionDays: 7, trashRetentionDays: 7 });
    const changed = await server.inject({ method: "PUT", url: "/api/v1/settings", payload: {
      expectedRevision: 1, imageRetentionDays: 2, historyRetentionDays: 14, trashRetentionDays: 30,
    } });
    expect(changed.statusCode).toBe(200);
    expect(new WorkspaceSettingsRepository(database).get()).toEqual(changed.json());
    expect((await server.inject({ method: "PUT", url: "/api/v1/settings", payload: {
      expectedRevision: 1, imageRetentionDays: 1, historyRetentionDays: 7, trashRetentionDays: 7,
    } })).statusCode).toBe(409);
    for (const days of [0, -1, 1.5, 3651, null]) {
      expect((await server.inject({ method: "PUT", url: "/api/v1/settings", payload: {
        expectedRevision: 2, imageRetentionDays: days, historyRetentionDays: 7, trashRetentionDays: 7,
      } })).statusCode).toBe(400);
    }
    database.close();
    database = openDatabase(join(directory, "test.db"), resolve("migrations"));
    expect(new WorkspaceSettingsRepository(database).get().trashRetentionDays).toBe(30);
  } finally { await server.close(); }
});

it("applies configured windows without collecting the latest version or referenced images", async () => {
  const f = await fixture();
  f.settings.update({ expectedRevision: 1, imageRetentionDays: 3, historyRetentionDays: 2, trashRetentionDays: 7 });
  const session = f.projects.createSession({ sessionType: "ui-layout", title: "Retention" });
  const image = await f.assets.create(session.id, { filename: "unused.png", data: png });
  for (let revision = 0; revision < 3; revision++) f.versions.createDraftVersion(session.id, { expectedLatestRevision: revision, draft: createUiSketchDraft() });
  database.prepare("UPDATE ui_sketch_draft_versions SET created_at = ?").run(new Date(Date.now() - 3 * day).toISOString());
  f.storage.protect(session.id, "editor", { revisions: [1], assetIds: [] });
  await f.storage.collect();
  expect(f.versions.listDraftVersions(session.id).map(version => version.revision)).toEqual([1, 3]);
  f.advance(2);
  expect((await f.storage.collect()).imagesDeleted).toBe(0);
  f.advance(1);
  expect((await f.storage.collect()).imagesDeleted).toBe(1);
  expect(database.prepare("SELECT id FROM image_assets WHERE id = ?").get(image.id)).toBeUndefined();
  expect(f.versions.getLatestDraftVersion(session.id)!.revision).toBe(3);
});

it("keeps trashed contents intact, restores membership, then purges only expired trash", async () => {
  const f = await fixture();
  const project = f.projects.createProject({ name: "Trash" });
  const group = f.projects.createSessionGroup(project.id, { name: "Group" });
  const session = f.projects.createSession({ sessionType: "ui-layout", title: "Recover", projectId: project.id, groupId: group.id });
  await f.assets.create(session.id, { filename: "unused.png", data: png });
  for (let revision = 0; revision < 2; revision++) f.versions.createDraftVersion(session.id, { expectedLatestRevision: revision, draft: createUiSketchDraft() });
  f.projects.deleteSession(session.id, { expectedRevision: session.revision });
  expect(f.projects.listSessions()).toEqual([]);
  expect(f.projects.getProject(project.id).sessionCount).toBe(0);
  expect(f.projects.listSessionGroups()[0].sessionIds).toEqual([]);
  expect(() => f.versions.getLatestDraftVersion(session.id)).toThrow(expect.objectContaining({ code: "SESSION_NOT_FOUND" }));
  f.advance(6);
  await f.storage.collect();
  expect(database.prepare("SELECT count(*) AS count FROM ui_sketch_draft_versions").get()).toEqual({ count: 2 });
  expect(database.prepare("SELECT count(*) AS count FROM image_assets").get()).toEqual({ count: 1 });
  const trashed = f.projects.listTrashSessions()[0];
  expect(() => f.projects.restoreSession(session.id, { expectedRevision: session.revision })).toThrow(expect.objectContaining({ code: "REVISION_CONFLICT" }));
  const restored = f.projects.restoreSession(session.id, { expectedRevision: trashed.revision });
  expect(restored.projectId).toBe(project.id);
  expect(f.projects.listSessionGroups()[0].sessionIds).toEqual([session.id]);
  expect(f.versions.listDraftVersions(session.id)).toHaveLength(2);
  f.projects.deleteSession(session.id, { expectedRevision: restored.revision });
  f.projects.deleteProject(project.id, { expectedRevision: project.revision });
  expect(f.projects.listTrashSessions()[0].projectId).toBeNull();
  f.settings.update({ ...f.settings.get(), expectedRevision: 1, trashRetentionDays: 2 });
  f.advance(2);
  await f.storage.collect();
  expect(f.projects.listTrashSessions()).toEqual([]);
  expect(database.prepare("SELECT count(*) AS count FROM ui_sketch_draft_versions").get()).toEqual({ count: 0 });
  expect(f.projects.listSessions()).toEqual([]);
});

it("exposes trash and restore through the API with revision checks", async () => {
  const f = await fixture();
  const session = f.projects.createSession({ sessionType: "spatial", title: "API trash" });
  const server = buildServer({}, { projectSessions: f.projects });
  try {
    expect((await server.inject({ method: "DELETE", url: `/api/v1/sessions/${session.id}`, payload: { expectedRevision: 1 } })).statusCode).toBe(204);
    expect((await server.inject(`/api/v1/sessions/${session.id}`)).statusCode).toBe(404);
    const trash = (await server.inject("/api/v1/trash/sessions")).json().sessions[0];
    expect(trash).toMatchObject({ id: session.id, revision: 2, deletedAt: expect.any(String) });
    expect((await server.inject({ method: "POST", url: `/api/v1/trash/sessions/${session.id}/restore`, payload: { expectedRevision: 1 } })).statusCode).toBe(409);
    const response = await server.inject({ method: "POST", url: `/api/v1/trash/sessions/${session.id}/restore`, payload: { expectedRevision: 2 } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: session.id, revision: 3 });
    expect((await server.inject("/api/v1/trash/sessions")).json().sessions).toEqual([]);
  } finally { await server.close(); }
});

it("permanently deletes a single trashed session with revision checks and cascades its contents", async () => {
  const f = await fixture();
  const session = f.projects.createSession({ sessionType: "ui-layout", title: "Delete now" });
  const active = f.projects.createSession({ sessionType: "spatial", title: "Keep active" });
  const image = await f.assets.create(session.id, { filename: "unused.png", data: png });
  f.versions.createDraftVersion(session.id, { expectedLatestRevision: 0, draft: createUiSketchDraft() });
  f.projects.deleteSession(session.id, { expectedRevision: session.revision });
  const server = buildServer({}, { projectSessions: f.projects });
  try {
    const remove = (id: string, expectedRevision: number) => server.inject({ method: "DELETE", url: `/api/v1/trash/sessions/${id}`, payload: { expectedRevision } });
    expect((await remove(active.id, active.revision)).statusCode).toBe(404);
    expect((await remove(session.id, 1)).statusCode).toBe(409);
    expect(f.projects.listTrashSessions()).toHaveLength(1);
    expect((await remove(session.id, 2)).statusCode).toBe(204);
    expect(f.projects.listTrashSessions()).toEqual([]);
    expect(database.prepare("SELECT id FROM image_assets WHERE id = ?").get(image.id)).toBeUndefined();
    expect(database.prepare("SELECT id FROM ui_sketch_draft_versions WHERE session_id = ?").get(session.id)).toBeUndefined();
    expect((await remove(session.id, 2)).statusCode).toBe(404);
    expect(f.projects.getSession(active.id)).toMatchObject({ id: active.id });
    // Managed files follow the existing orphan collector after ownership is removed.
    await f.storage.collect(); f.advance(2);
    expect((await f.storage.collect()).imagesDeleted).toBe(1);
  } finally { await server.close(); }
});

it("empties only current trash across all session types, retaining active and restored sessions", async () => {
  const f = await fixture();
  const project = f.projects.createProject({ name: "Keep project" });
  const active = f.projects.createSession({ sessionType: "image-composition", title: "Active", projectId: project.id });
  const trash = SESSION_TYPES.map(sessionType => {
    const session = f.projects.createSession({ sessionType, title: sessionType });
    f.projects.deleteSession(session.id, { expectedRevision: session.revision }); return session;
  });
  f.projects.restoreSession(trash[0].id, { expectedRevision: 2 });
  const server = buildServer({}, { projectSessions: f.projects });
  try {
    expect((await server.inject({ method: "DELETE", url: "/api/v1/trash/sessions" })).statusCode).toBe(204);
    expect(f.projects.listTrashSessions()).toEqual([]);
    expect(f.projects.listSessions().map(session => session.id).sort()).toEqual([active.id, trash[0].id].sort());
    expect(f.projects.getProject(project.id).sessionCount).toBe(1);
    expect((await server.inject({ method: "DELETE", url: "/api/v1/trash/sessions" })).statusCode).toBe(204);
  } finally { await server.close(); }
});
