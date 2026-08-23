import { resolve } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { buildServer } from "../../src/server/app.js";

const migrationsDirectory = resolve("migrations");

describe("project and typed session API", () => {
  let database: DatabaseConnection | undefined;
  let server: FastifyInstance | undefined;

  afterEach(async () => {
    await server?.close();
    database?.close();
  });

  it("creates, groups, and moves composition and UI sessions", async () => {
    ({ database, server } = createTestServer());

    const projectResponse = await server.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: { name: "发布项目", description: "同一目标下的多种表达会话" },
    });
    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json<{ id: string; revision: number }>();

    const uiResponse = await server.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        sessionType: "ui-layout",
        title: "落地页布局",
        projectId: project.id,
      },
    });
    expect(uiResponse.statusCode).toBe(201);

    const compositionResponse = await server.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        sessionType: "image-composition",
        title: "主视觉构图",
      },
    });
    expect(compositionResponse.statusCode).toBe(201);
    const composition = compositionResponse.json<{
      id: string;
      projectId: string | null;
      revision: number;
    }>();
    expect(composition).toMatchObject({ projectId: null, revision: 1 });

    expect(
      database.prepare("SELECT session_id FROM composition_sessions").all(),
    ).toEqual([{ session_id: composition.id }]);
    expect(database.prepare("SELECT count(*) AS count FROM ui_sessions").get()).toEqual({
      count: 1,
    });

    const unassigned = await server.inject({
      method: "GET",
      url: "/api/v1/sessions/unassigned",
    });
    expect(unassigned.json<{ sessions: Array<{ id: string }> }>().sessions).toEqual([
      expect.objectContaining({ id: composition.id }),
    ]);

    const movedResponse = await server.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${composition.id}/project`,
      payload: { projectId: project.id, expectedRevision: 1 },
    });
    expect(movedResponse.statusCode).toBe(200);
    expect(movedResponse.json()).toMatchObject({
      id: composition.id,
      projectId: project.id,
      revision: 2,
      sessionType: "image-composition",
    });

    const projectSessions = await server.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/sessions`,
    });
    expect(projectSessions.json<{ sessions: Array<{ sessionType: string }> }>().sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionType: "ui-layout" }),
        expect.objectContaining({ sessionType: "image-composition" }),
      ]),
    );

    const conflict = await server.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${composition.id}/project`,
      payload: { projectId: null, expectedRevision: 1 },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      code: "REVISION_CONFLICT",
      message: "Expected revision 1, received 2",
      actualRevision: 2,
    });

    const movedBack = await server.inject({
      method: "PATCH",
      url: `/api/v1/sessions/${composition.id}/project`,
      payload: { projectId: null, expectedRevision: 2 },
    });
    expect(movedBack.statusCode, movedBack.body).toBe(200);
    expect(movedBack.json()).toMatchObject({
      id: composition.id,
      projectId: null,
      revision: 3,
    });

    const projectAfterMove = await server.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}`,
    });
    expect(projectAfterMove.json()).toMatchObject({ sessionCount: 1 });

    const unassignedAfterMove = await server.inject({
      method: "GET",
      url: "/api/v1/sessions/unassigned",
    });
    expect(
      unassignedAfterMove.json<{ sessions: Array<{ id: string }> }>().sessions,
    ).toEqual([expect.objectContaining({ id: composition.id })]);
  });

  it("updates project metadata without accepting stale revisions", async () => {
    ({ database, server } = createTestServer());
    const created = await server.inject({
      method: "POST",
      url: "/api/v1/projects",
      payload: { name: "旧名称" },
    });
    const project = created.json<{ id: string }>();

    const updated = await server.inject({
      method: "PATCH",
      url: `/api/v1/projects/${project.id}`,
      payload: { name: "新名称", expectedRevision: 1 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ name: "新名称", revision: 2 });

    const conflict = await server.inject({
      method: "PATCH",
      url: `/api/v1/projects/${project.id}`,
      payload: { description: "过期写入", expectedRevision: 1 },
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("rejects unsupported types and missing projects", async () => {
    ({ database, server } = createTestServer());

    const unsupported = await server.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { sessionType: "song", title: "尚未定义" },
    });
    expect(unsupported.statusCode).toBe(400);
    expect(unsupported.json()).toMatchObject({ code: "VALIDATION_ERROR" });

    const missingProject = await server.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: {
        sessionType: "ui-layout",
        title: "无归属目标",
        projectId: "missing-project",
      },
    });
    expect(missingProject.statusCode).toBe(404);
    expect(missingProject.json()).toMatchObject({ code: "PROJECT_NOT_FOUND" });
  });

  function createTestServer(): {
    database: DatabaseConnection;
    server: FastifyInstance;
  } {
    const database = openDatabase(":memory:", migrationsDirectory);
    const repository = new ProjectSessionRepository(database);
    return {
      database,
      server: buildServer({}, { projectSessions: repository }),
    };
  }
});
