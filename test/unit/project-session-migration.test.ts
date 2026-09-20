import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";

const migrationsDirectory = resolve("migrations");

describe("project and typed session migration", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("creates the shared index and all supported session roots", () => {
    const database = openDatabase(":memory:", migrationsDirectory);

    expect(
      database
        .prepare("SELECT code FROM session_types ORDER BY code")
        .all(),
    ).toEqual([{ code: "image-composition" }, { code: "spatial" }, { code: "ui-layout" }]);
    expect(
      database
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table'
             AND name IN ('projects', 'sessions', 'composition_sessions', 'ui_sessions', 'spatial_sessions')
           ORDER BY name`,
        )
        .all(),
    ).toEqual([
      { name: "composition_sessions" },
      { name: "projects" },
      { name: "sessions" },
      { name: "spatial_sessions" },
      { name: "ui_sessions" },
    ]);

    database.close();
  });

  it("keeps sessions when their project is deleted", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    database
      .prepare(
        `INSERT INTO projects
          (id, name, description, revision, created_at, updated_at)
         VALUES ('project-1', 'Project', NULL, 1, 'now', 'now')`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO sessions
          (id, project_id, session_type, title, lifecycle_stage, revision, created_at, updated_at)
         VALUES ('session-1', 'project-1', 'image-composition', 'Draft', 'draft', 1, 'now', 'now')`,
      )
      .run();

    database.prepare("DELETE FROM projects WHERE id = 'project-1'").run();

    expect(database.prepare("SELECT project_id FROM sessions WHERE id = 'session-1'").get()).toEqual({
      project_id: null,
    });
    database.close();
  });

  it("persists project and session metadata across service restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "human2ai-project-sessions-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "human2ai.sqlite");
    let database = openDatabase(databasePath, migrationsDirectory);
    let repository = new ProjectSessionRepository(database);
    const project = repository.createProject({ name: "持久化项目" });
    const session = repository.createSession({
      sessionType: "image-composition",
      title: "持久化构图",
      projectId: project.id,
    });
    database.close();

    database = openDatabase(databasePath, migrationsDirectory);
    repository = new ProjectSessionRepository(database);

    expect(repository.getProject(project.id)).toMatchObject({ sessionCount: 1 });
    expect(repository.getSession(session.id)).toMatchObject({
      projectId: project.id,
      sessionType: "image-composition",
    });
    database.close();
  });
});
