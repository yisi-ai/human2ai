import { expect, it } from "vitest";
import { openDatabase } from "../../src/database/migrate.ts";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.ts";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.ts";
import { CompositionSessionRepository } from "../../src/database/composition-session-repository.ts";
import { SpatialSessionRepository } from "../../src/database/spatial-session-repository.ts";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";
import { createDraft } from "../../src/domain/composition/index.ts";
import { createSpatialDraft } from "../../src/domain/spatial/index.ts";

it("publishes committed saves and restores across capture adapters, never rolled-back or conflicting appends", async () => {
  const database = openDatabase(":memory:", "migrations");
  try {
    const projects = new ProjectSessionRepository(database);
    const cases = [
      { type: "ui-layout" as const, repository: new UiSketchSessionRepository(database), draft: createUiSketchDraft() },
      { type: "image-composition" as const, repository: new CompositionSessionRepository(database), draft: createDraft() },
      { type: "spatial" as const, repository: new SpatialSessionRepository(database), draft: createSpatialDraft() },
    ];
    for (const { type, repository, draft } of cases) {
      const session = projects.createSession({ sessionType: type, title: type });
      const revisions: number[] = [];
      const unsubscribe = repository.onDraftSaved(({ version }) => revisions.push(version.revision));
      expect(() => database.transaction(() => {
        repository.createDraftVersion(session.id, { expectedLatestRevision: 0, draft });
        throw new Error("rollback");
      })()).toThrow("rollback");
      await Promise.resolve(); expect(revisions).toEqual([]);
      repository.createDraftVersion(session.id, { expectedLatestRevision: 0, draft });
      await Promise.resolve(); expect(revisions).toEqual([1]);
      expect(() => repository.createDraftVersion(session.id, { expectedLatestRevision: 0, draft })).toThrow();
      repository.restoreDraftVersion(session.id, { expectedLatestRevision: 1, targetRevision: 1 });
      await Promise.resolve(); expect(revisions).toEqual([1, 2]);
      unsubscribe();
    }
  } finally { database.close(); }
});
