import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { openDatabase } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import {
  addFocus,
  createDraft,
  draftFingerprint,
  type CompositionRefinementPlan,
} from "../../src/domain/composition/index.js";

const migrationsDirectory = resolve("migrations");

describe("CompositionSessionRepository", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("persists draft versions and refinement runs across database restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "human2ai-composition-session-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "human2ai.sqlite");
    let database = openDatabase(databasePath, migrationsDirectory);
    const session = new ProjectSessionRepository(database).createSession({
      sessionType: "image-composition",
      title: "持久化构图",
    });
    let repository = new CompositionSessionRepository(database);
    const draft = addFocus(createDraft(), { x: 0.61, y: 0.39 }).draft;
    const version = repository.createDraftVersion(session.id, {
      expectedLatestRevision: 0,
      draft,
    });
    const plan: CompositionRefinementPlan = {
      version: 1,
      kind: "composition-refinement-plan",
      sourceFingerprint: draftFingerprint(draft),
      rationale: "Agent selects a nearby golden-section anchor.",
      operations: [
        {
          method: "focus-anchor",
          methodVersion: 1,
          targetFocusId: "focus-1",
          anchor: "golden-right-upper",
          strength: "subtle",
        },
      ],
    };
    const run = repository.createRefinementRun(session.id, {
      sourceDraftRevision: 1,
      plan,
    });
    database.close();

    database = openDatabase(databasePath, migrationsDirectory);
    repository = new CompositionSessionRepository(database);

    expect(repository.getDraftVersion(session.id, 1)).toEqual(version);
    expect(repository.getRefinementRun(session.id, run.id)).toEqual(run);
    database.close();
  });

  it("removes composition details when their owning session is deleted", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    const session = new ProjectSessionRepository(database).createSession({
      sessionType: "image-composition",
      title: "临时构图",
    });
    new CompositionSessionRepository(database).createDraftVersion(session.id, {
      expectedLatestRevision: 0,
      draft: createDraft(),
    });

    database.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);

    expect(database.prepare("SELECT count(*) AS count FROM composition_draft_versions").get())
      .toEqual({ count: 0 });
    database.close();
  });

  it("recomputes canonical fingerprints for drafts saved by older builds", () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    const session = new ProjectSessionRepository(database).createSession({
      sessionType: "image-composition",
      title: "旧指纹构图",
    });
    const repository = new CompositionSessionRepository(database);
    const draft = addFocus(createDraft(), { x: 0.61, y: 0.39 }).draft;
    repository.createDraftVersion(session.id, {
      expectedLatestRevision: 0,
      draft,
    });
    database
      .prepare("UPDATE composition_draft_versions SET fingerprint = ?")
      .run("draft-00000000");

    const restored = repository.getDraftVersion(session.id, 1);

    expect(restored.fingerprint).toBe(draftFingerprint(draft));
    const run = repository.createRefinementRun(session.id, {
      sourceDraftRevision: 1,
      plan: {
        version: 1,
        kind: "composition-refinement-plan",
        sourceFingerprint: restored.fingerprint,
        rationale: "Agent selects a nearby golden-section anchor.",
        operations: [
          {
            method: "focus-anchor",
            methodVersion: 1,
            targetFocusId: "focus-1",
            anchor: "golden-right-upper",
            strength: "subtle",
          },
        ],
      },
    });
    expect(run.sourceFingerprint).toBe(restored.fingerprint);
    database.close();
  });
});
