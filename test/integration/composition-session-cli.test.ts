import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";

import {
  executeCli,
  type CliDependencies,
} from "../../src/cli/main.js";
import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { openDatabase } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import {
  addArea,
  addFocus,
  createDraft,
  draftFingerprint,
} from "../../src/domain/composition/index.js";
import { buildServer } from "../../src/server/app.js";

const migrationsDirectory = path.resolve("migrations");

describe("composition session CLI", () => {
  it("saves, inspects, refines, and reads a persisted composition through HTTP", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-session-cli-"));
    const database = openDatabase(":memory:", migrationsDirectory);
    const projectSessions = new ProjectSessionRepository(database);
    const compositionSessions = new CompositionSessionRepository(database);
    const server = buildServer({}, { compositionSessions, projectSessions });
    const dependencies: CliDependencies = {
      fetch: createServerFetch(server),
      serviceUrl: "http://human2ai.test",
    };

    try {
      const session = projectSessions.createSession({
        sessionType: "image-composition",
        title: "CLI 构图",
      });
      let draft = addFocus(createDraft(), { x: 0.61, y: 0.39 }).draft;
      draft = addArea(draft, {
        primitive: "quadrilateral",
        aspect: "free",
        area: 0.1,
        x: 0.5,
        y: 0.5,
        rotation: 2,
      }).draft;
      expect(draftFingerprint(draft)).toBe("draft-b559b9b1");
      const draftPath = path.join(directory, "draft.json");
      const planPath = path.join(directory, "plan.json");
      const stalePlanPath = path.join(directory, "stale-plan.json");
      const inspectionPreview = path.join(directory, "inspection.svg");
      const runOutput = path.join(directory, "run.json");
      const runPreview = path.join(directory, "refined.svg");
      const plan = {
        version: 1,
        kind: "composition-refinement-plan",
        sourceFingerprint: draftFingerprint(draft),
        rationale: "Agent selects the nearby golden focus and horizontal mass axis.",
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
      await writeFile(draftPath, JSON.stringify(draft), "utf8");
      await writeFile(planPath, JSON.stringify(plan), "utf8");
      await writeFile(
        stalePlanPath,
        JSON.stringify({ ...plan, sourceFingerprint: "draft-00000000" }),
        "utf8",
      );

      const saved = (await executeCli(
        [
          "composition",
          "save",
          "--session",
          session.id,
          "--draft",
          draftPath,
          "--expected-revision",
          "0",
        ],
        dependencies,
      )) as { revision: number; fingerprint: string; draft: typeof draft };
      expect(saved).toMatchObject({ revision: 1, fingerprint: draftFingerprint(draft) });
      expect(saved.draft).toEqual(draft);

      const versions = (await executeCli(
        ["composition", "drafts", "--session", session.id],
        dependencies,
      )) as { draftVersions: Array<{ revision: number; draft: typeof draft }> };
      expect(versions.draftVersions).toEqual([expect.objectContaining({ revision: 1 })]);
      expect(versions.draftVersions[0].draft).toEqual(draft);

      const inspection = (await executeCli(
        [
          "composition",
          "inspect",
          "--session",
          session.id,
          "--revision",
          "1",
          "--preview",
          inspectionPreview,
        ],
        dependencies,
      )) as {
        sourceFingerprint: string;
        source: { mode: string; draftRevision: number };
      };
      expect(inspection).toMatchObject({
        sourceFingerprint: draftFingerprint(draft),
        source: { mode: "session", draftRevision: 1 },
      });
      expect(await readFile(inspectionPreview, "utf8")).toMatch(/^<svg/);

      const applied = (await executeCli(
        [
          "composition",
          "apply",
          "--session",
          session.id,
          "--revision",
          "1",
          "--plan",
          planPath,
          "--output",
          runOutput,
          "--preview",
          runPreview,
        ],
        dependencies,
      )) as {
        id: string;
        sourceDraftRevision: number;
        result: { audit: { passed: boolean } };
      };
      expect(applied).toMatchObject({
        sourceDraftRevision: 1,
        result: { audit: { passed: true } },
      });
      expect(JSON.parse(await readFile(runOutput, "utf8"))).toMatchObject({
        id: applied.id,
        result: { audit: { passed: true } },
      });
      expect(await readFile(runPreview, "utf8")).toMatch(/^<svg/);

      const runs = (await executeCli(
        ["composition", "refinements", "--session", session.id],
        dependencies,
      )) as { refinementRuns: Array<{ id: string }> };
      expect(runs.refinementRuns).toEqual([expect.objectContaining({ id: applied.id })]);

      const fetched = (await executeCli(
        [
          "composition",
          "refinement",
          "--session",
          session.id,
          "--run",
          applied.id,
        ],
        dependencies,
      )) as { id: string; result: { audit: { passed: boolean } } };
      expect(fetched).toMatchObject({ id: applied.id, result: { audit: { passed: true } } });

      await expect(
        executeCli(
          [
            "composition",
            "apply",
            "--session",
            session.id,
            "--revision",
            "1",
            "--plan",
            stalePlanPath,
          ],
          dependencies,
        ),
      ).rejects.toMatchObject({
        code: "REFINEMENT_PLAN_STALE",
        status: 409,
      });
    } finally {
      await server.close();
      database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("manages projects and typed sessions through the same HTTP service", async () => {
    const database = openDatabase(":memory:", migrationsDirectory);
    const projectSessions = new ProjectSessionRepository(database);
    const compositionSessions = new CompositionSessionRepository(database);
    const server = buildServer({}, { compositionSessions, projectSessions });
    const dependencies: CliDependencies = {
      fetch: createServerFetch(server),
      serviceUrl: "http://human2ai.test",
    };

    try {
      const initialProjects = (await executeCli(
        ["project", "list"],
        dependencies,
      )) as { projects: unknown[] };
      expect(initialProjects.projects).toEqual([]);

      const project = (await executeCli(
        [
          "project",
          "create",
          "--name",
          "品牌发布",
          "--description",
          "构图和 UI 会话",
        ],
        dependencies,
      )) as { id: string; revision: number };
      expect(project).toMatchObject({ revision: 1 });

      const fetchedProject = await executeCli(
        ["project", "get", "--project", project.id],
        dependencies,
      );
      expect(fetchedProject).toMatchObject({ id: project.id, name: "品牌发布" });

      const updatedProject = await executeCli(
        [
          "project",
          "update",
          "--project",
          project.id,
          "--expected-revision",
          "1",
          "--name",
          "品牌发布 2",
        ],
        dependencies,
      );
      expect(updatedProject).toMatchObject({ name: "品牌发布 2", revision: 2 });

      const composition = (await executeCli(
        [
          "session",
          "create",
          "--type",
          "image-composition",
          "--title",
          "主视觉构图",
          "--project",
          project.id,
        ],
        dependencies,
      )) as { id: string; revision: number };
      const ui = (await executeCli(
        [
          "session",
          "create",
          "--type",
          "ui-layout",
          "--title",
          "落地页布局",
        ],
        dependencies,
      )) as { id: string; revision: number };

      const projectList = (await executeCli(
        ["session", "list", "--project", project.id],
        dependencies,
      )) as { sessions: Array<{ id: string }> };
      expect(projectList.sessions).toEqual([
        expect.objectContaining({ id: composition.id }),
      ]);

      const unassigned = (await executeCli(
        ["session", "list", "--unassigned"],
        dependencies,
      )) as { sessions: Array<{ id: string }> };
      expect(unassigned.sessions).toEqual([expect.objectContaining({ id: ui.id })]);

      const fetchedSession = await executeCli(
        ["session", "get", "--session", ui.id],
        dependencies,
      );
      expect(fetchedSession).toMatchObject({ id: ui.id, projectId: null });

      const moved = await executeCli(
        [
          "session",
          "move",
          "--session",
          ui.id,
          "--project",
          project.id,
          "--expected-revision",
          "1",
        ],
        dependencies,
      );
      expect(moved).toMatchObject({ projectId: project.id, revision: 2 });

      await expect(
        executeCli(
          [
            "session",
            "move",
            "--session",
            ui.id,
            "--unassigned",
            "--expected-revision",
            "1",
          ],
          dependencies,
        ),
      ).rejects.toMatchObject({ code: "REVISION_CONFLICT", status: 409 });

      const movedBack = await executeCli(
        [
          "session",
          "move",
          "--session",
          ui.id,
          "--unassigned",
          "--expected-revision",
          "2",
        ],
        dependencies,
      );
      expect(movedBack).toMatchObject({ projectId: null, revision: 3 });

      await expect(
        executeCli(
          [
            "session",
            "list",
            "--project",
            project.id,
            "--unassigned",
          ],
          dependencies,
        ),
      ).rejects.toThrow(/cannot be used together/i);
    } finally {
      await server.close();
      database.close();
    }
  });
});

function createServerFetch(server: FastifyInstance): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const response = await server.inject({
      method: (init?.method ?? "GET") as "GET" | "POST" | "PATCH",
      url: `${url.pathname}${url.search}`,
      payload: typeof init?.body === "string" ? init.body : undefined,
      headers: { "content-type": "application/json" },
    });
    return new Response(response.body, {
      status: response.statusCode,
      headers: { "content-type": "application/json" },
    });
  };
}
