import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import {
  UiSketchDraftRevisionConflictError,
  UiSketchSessionRepository,
  UiSketchSessionRequiredError,
} from "../../src/database/ui-sketch-session-repository.js";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.js";

const migrationsDirectory = resolve("migrations");

describe("UiSketchSessionRepository", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("persists immutable draft versions across database restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "human2ai-ui-sketch-session-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "human2ai.sqlite");
    let database = openDatabase(databasePath, migrationsDirectory);
    const session = new ProjectSessionRepository(database).createSession({
      sessionType: "ui-layout",
      title: "登录页草图",
    });
    let repository = new UiSketchSessionRepository(database);
    const draft = createUiSketchDraft();
    draft.texts.push({
      id: "title",
      x: 80,
      y: 64,
      text: "欢迎回来",
      fontSize: 32,
      note: "页面标题",
      annotation: "",
      semanticType: "标题",
      origin: "import",
      visible: true,
      weight: "high",
    });
    const version = repository.createDraftVersion(session.id, {
      expectedLatestRevision: 0,
      draft,
    });
    database.close();

    database = openDatabase(databasePath, migrationsDirectory);
    repository = new UiSketchSessionRepository(database);
    expect(repository.getDraftVersion(session.id, 1)).toEqual(version);
    database.close();
  });

  it("enforces revision and session type boundaries", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    const sessions = new ProjectSessionRepository(database);
    const uiSession = sessions.createSession({
      sessionType: "ui-layout",
      title: "UI 草图",
    });
    const compositionSession = sessions.createSession({
      sessionType: "image-composition",
      title: "构图",
    });
    const repository = new UiSketchSessionRepository(database);
    repository.createDraftVersion(uiSession.id, {
      expectedLatestRevision: 0,
      draft: createUiSketchDraft(),
    });

    expect(() =>
      repository.createDraftVersion(uiSession.id, {
        expectedLatestRevision: 0,
        draft: createUiSketchDraft(),
      }),
    ).toThrow(UiSketchDraftRevisionConflictError);
    expect(() => repository.listDraftVersions(compositionSession.id)).toThrow(
      UiSketchSessionRequiredError,
    );

    database.prepare("DELETE FROM sessions WHERE id = ?").run(uiSession.id);
    expect(
      database.prepare("SELECT count(*) AS count FROM ui_sketch_draft_versions").get(),
    ).toEqual({ count: 0 });
    database.close();
  });
});
