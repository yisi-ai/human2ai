import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { buildServer } from "../../src/server/app.js";
import type { FastifyInstance } from "fastify";

describe("project display groups", () => {
  let directory: string;
  let database: DatabaseConnection;
  let repository: ProjectSessionRepository;
  let server: FastifyInstance;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "h2a-groups-"));
    database = openDatabase(join(directory, "test.sqlite"), resolve("migrations"));
    repository = new ProjectSessionRepository(database);
    server = buildServer({}, { projectSessions: repository });
  });
  afterEach(async () => { await server.close(); database.close(); rmSync(directory, { recursive: true, force: true }); });

  async function createGroup(projectId: string, name = "参考") {
    const response = await server.inject({ method: "POST", url: `/api/v1/projects/${projectId}/groups`, payload: { name } });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ id: string; revision: number; name: string; sessionIds: string[] }>();
  }
  async function assign(projectId: string, sessionId: string, groupId: string | null) {
    return server.inject({ method: "PUT", url: `/api/v1/projects/${projectId}/sessions/${sessionId}/group`, payload: { groupId } });
  }
  async function groups() { return (await server.inject({ method: "GET", url: "/api/v1/session-groups" })).json().groups; }

  it.each(["image-composition", "ui-layout", "spatial"] as const)("creates %s directly in a group and persists membership", async sessionType => {
    const project = repository.createProject({ name: "项目" });
    const group = await createGroup(project.id);
    const response = await server.inject({ method: "POST", url: "/api/v1/sessions", payload: {
      sessionType, title: "新会话", projectId: project.id, groupId: group.id,
    } });
    expect(response.statusCode, response.body).toBe(201);
    const session = response.json();
    expect(session).toMatchObject({ projectId: project.id, sessionType, revision: 1 });
    await server.close(); database.close();
    database = openDatabase(join(directory, "test.sqlite"), resolve("migrations"));
    repository = new ProjectSessionRepository(database);
    server = buildServer({}, { projectSessions: repository });
    expect(await groups()).toEqual([expect.objectContaining({ id: group.id, revision: 1, sessionIds: [session.id] })]);
    expect(repository.getSession(session.id)).toEqual(session);
    expect(repository.getProject(project.id)).toMatchObject({ revision: project.revision, updatedAt: project.updatedAt });
  });

  it.each(["image-composition", "ui-layout", "spatial"] as const)("rolls back %s creation when its target group is invalid", async sessionType => {
    const project = repository.createProject({ name: "项目" });
    const other = repository.createProject({ name: "其他项目" });
    const group = await createGroup(other.id);
    for (const [projectId, groupId, status] of [[project.id, "missing", 404], [project.id, group.id, 400], [null, group.id, 400]] as const) {
      const response = await server.inject({ method: "POST", url: "/api/v1/sessions", payload: { sessionType, title: "新会话", projectId, groupId } });
      expect(response.statusCode, response.body).toBe(status);
      for (const table of ["sessions", "composition_sessions", "ui_sessions", "spatial_sessions", "session_group_members"]) {
        expect(database.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
      }
    }
  });

  it("persists empty groups, renames them, and releases members without changing sessions", async () => {
    const project = repository.createProject({ name: "项目" });
    const sessions = (["image-composition", "ui-layout", "spatial"] as const).map(sessionType => repository.createSession({ projectId: project.id, sessionType, title: sessionType }));
    const group = await createGroup(project.id);
    expect(group.sessionIds).toEqual([]);
    const second = await createGroup(project.id, "空分组");
    for (const session of sessions) expect((await assign(project.id, session.id, group.id)).statusCode).toBe(204);
    expect((await assign(project.id, sessions[0].id, second.id)).statusCode).toBe(204);
    expect((await groups()).find((g: { id: string }) => g.id === group.id).sessionIds).toHaveLength(2);
    expect((await assign(project.id, sessions[0].id, null)).statusCode).toBe(204);
    const renamed = await server.inject({ method: "PATCH", url: `/api/v1/session-groups/${group.id}`, payload: { name: "已整理", expectedRevision: 1 } });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ name: "已整理", revision: 2 });
    await server.close(); database.close();
    database = openDatabase(join(directory, "test.sqlite"), resolve("migrations"));
    repository = new ProjectSessionRepository(database);
    server = buildServer({}, { projectSessions: repository });
    expect(await groups()).toEqual(expect.arrayContaining([expect.objectContaining({ id: group.id, name: "已整理", sessionIds: expect.arrayContaining(sessions.slice(1).map(s => s.id)) }), expect.objectContaining({ id: second.id, sessionIds: [] })]));
    const stale = await server.inject({ method: "DELETE", url: `/api/v1/session-groups/${group.id}`, payload: { expectedRevision: 1 } });
    expect(stale.statusCode).toBe(409);
    expect((await server.inject({ method: "DELETE", url: `/api/v1/session-groups/${group.id}`, payload: { expectedRevision: 2 } })).statusCode).toBe(204);
    expect(await groups()).toEqual([expect.objectContaining({ id: second.id, sessionIds: [] })]);
    expect(sessions.map(s => repository.getSession(s.id))).toEqual(sessions);
    expect(repository.getProject(project.id)).toEqual(expect.objectContaining({ revision: project.revision, updatedAt: project.updatedAt }));
  });

  it("rejects invalid names and cross-project assignments; existing project moves clear membership", async () => {
    const a = repository.createProject({ name: "A" });
    const b = repository.createProject({ name: "B" });
    const session = repository.createSession({ projectId: a.id, sessionType: "ui-layout", title: "UI" });
    const group = await createGroup(a.id);
    const other = await createGroup(b.id);
    for (const name of [" ", "a".repeat(201)]) {
      expect((await server.inject({ method: "POST", url: `/api/v1/projects/${a.id}/groups`, payload: { name } })).statusCode).toBe(400);
    }
    expect((await server.inject({ method: "POST", url: `/api/v1/projects/${a.id}/groups`, payload: { name: "参考" } })).statusCode).toBe(409);
    expect((await server.inject({ method: "POST", url: "/api/v1/projects/missing/groups", payload: { name: "参考" } })).statusCode).toBe(404);
    expect((await assign(a.id, session.id, other.id)).statusCode).toBe(400);
    expect((await assign(b.id, session.id, other.id)).statusCode).toBe(400);
    expect((await assign(a.id, session.id, "missing")).statusCode).toBe(404);
    expect((await assign(a.id, "missing", group.id)).statusCode).toBe(404);
    expect((await assign(a.id, session.id, group.id)).statusCode).toBe(204);
    repository.moveSession(session.id, { projectId: b.id, expectedRevision: session.revision });
    expect((await groups()).every((g: { sessionIds: string[] }) => g.sessionIds.length === 0)).toBe(true);
    expect((await assign(b.id, session.id, other.id)).statusCode).toBe(204);
    repository.deleteSession(session.id, { expectedRevision: 2 });
    expect((await groups()).every((g: { sessionIds: string[] }) => g.sessionIds.length === 0)).toBe(true);
    repository.deleteProject(a.id, { expectedRevision: a.revision });
    expect(await groups()).toEqual([expect.objectContaining({ id: other.id })]);
  });
});
