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
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.js";
import {
  addArea,
  addFocus,
  createDraft,
  draftFingerprint,
  setProcessingSemantic,
} from "../../src/domain/composition/index.js";
import {
  createUiSketchDraft,
  uiSketchDraftFingerprint,
  validateUiSketchDraft,
} from "../../src/domain/ui-sketch/index.js";
import { buildServer } from "../../src/server/app.js";

const migrationsDirectory = path.resolve("migrations");

describe("composition session CLI", () => {
  it("connects, opens, and undoes session captures through versioned CLI commands", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-connect-cli-"));
    const database = openDatabase(":memory:", migrationsDirectory);
    const projectSessions = new ProjectSessionRepository(database);
    const compositionSessions = new CompositionSessionRepository(database);
    const uiSketchSessions = new UiSketchSessionRepository(database);
    const server = buildServer(
      {},
      { compositionSessions, projectSessions, uiSketchSessions },
    );
    const openedUrls: string[] = [];
    const dependencies: CliDependencies = {
      fetch: createServerFetch(server),
      serviceUrl: "http://human2ai-api.test",
      webUrl: "http://human2ai-web.test",
      openUrl: async (url) => {
        openedUrls.push(url);
      },
    };

    try {
      const status = await executeCli(["service", "status"], dependencies);
      expect(status).toMatchObject({
        kind: "service-status",
        status: "ready",
        apiUrl: "http://human2ai-api.test",
        webUrl: "http://human2ai-web.test",
      });

      const composition = projectSessions.createSession({
        sessionType: "image-composition",
        title: "Agent 构图会话",
      });
      const firstDraft = createDraft();
      const secondDraft = addFocus(firstDraft, { x: 0.4, y: 0.6 }).draft;
      const firstDraftPath = path.join(directory, "first-draft.json");
      const secondDraftPath = path.join(directory, "second-draft.json");
      await writeFile(firstDraftPath, JSON.stringify(firstDraft), "utf8");
      await writeFile(secondDraftPath, JSON.stringify(secondDraft), "utf8");

      await executeCli(
        [
          "capture", "save", "--session", composition.id,
          "--kind", "composition-draft", "--input", firstDraftPath,
          "--expected-revision", "0",
        ],
        dependencies,
      );
      await executeCli(
        [
          "capture", "save", "--session", composition.id,
          "--kind", "composition-draft", "--input", secondDraftPath,
          "--expected-revision", "1",
        ],
        dependencies,
      );

      const connection = await executeCli(
        ["session", "connect", "--session", composition.id],
        dependencies,
      );
      expect(connection).toMatchObject({
        version: 1,
        kind: "session-connection",
        service: {
          apiUrl: "http://human2ai-api.test",
          webUrl: "http://human2ai-web.test",
        },
        cli: { executable: "human2ai" },
        session: { id: composition.id, sessionType: "image-composition" },
        ui: {
          editUrl: `http://human2ai-web.test/composition/?session=${composition.id}`,
        },
        capture: {
          kind: "composition-draft",
          latest: { revision: 2 },
          commands: {
            get: expect.arrayContaining(["capture", "get", "--revision", "2"]),
            save: expect.arrayContaining(["--expected-revision", "2"]),
            undo: expect.arrayContaining(["--change-revision", "2"]),
          },
        },
        operations: expect.arrayContaining([
          expect.objectContaining({
            id: "composition.methods@1",
            sessionScoped: false,
            command: [
              "--api-url", "http://human2ai-api.test",
              "--web-url", "http://human2ai-web.test",
              "composition", "methods",
            ],
          }),
          expect.objectContaining({ id: "composition.refine@1" }),
        ]),
      });

      const opened = await executeCli(
        ["session", "open", "--session", composition.id],
        dependencies,
      );
      expect(opened).toMatchObject({ kind: "session-opened", opened: true });
      expect(openedUrls).toEqual([
        `http://human2ai-web.test/composition/?session=${composition.id}`,
      ]);

      const undone = await executeCli(
        [
          "capture", "undo", "--session", composition.id,
          "--kind", "composition-draft", "--change-revision", "2",
          "--expected-revision", "2",
        ],
        dependencies,
      );
      expect(undone).toMatchObject({
        kind: "capture-version",
        revision: 3,
        document: firstDraft,
        change: {
          type: "undo",
          undoesRevision: 2,
          restoredFromRevision: 1,
        },
      });

      const ui = projectSessions.createSession({
        sessionType: "ui-layout",
        title: "Agent UI 会话",
      });
      const uiConnection = await executeCli(
        [
          "--api-url", "http://override-api.test",
          "--web-url", "http://override-web.test",
          "session", "connect", "--session", ui.id,
        ],
        { fetch: createServerFetch(server) },
      );
      expect(uiConnection).toMatchObject({
        service: {
          apiUrl: "http://override-api.test",
          webUrl: "http://override-web.test",
        },
        session: { sessionType: "ui-layout" },
        ui: { editUrl: `http://override-web.test/ui-sketch/?session=${ui.id}` },
        capture: { kind: "ui-layout-draft", latest: null },
      });
      expect(uiConnection).toMatchObject({
        operations: expect.arrayContaining([
          expect.objectContaining({ id: "ui-layout.standardize@1", sessionScoped: false }),
        ]),
        capture: {
          commands: {
            save: expect.arrayContaining(["--expected-revision", "0"]),
          },
        },
      });

      const firstUiDraft = validateUiSketchDraft({
        ...createUiSketchDraft(),
        rectangles: [{ id: "button", x: 20, y: 30, width: 120, height: 40 }],
        texts: [{ id: "label", x: 40, y: 40, fontSize: 14, text: "保存" }],
        groups: [{ id: "button-group", itemIds: ["button", "label"] }],
      });
      const secondUiDraft = structuredClone(firstUiDraft);
      secondUiDraft.groups = [];
      secondUiDraft.overallNote = "Agent 调整界面层级";
      const firstUiDraftPath = path.join(directory, "first-ui-draft.json");
      const secondUiDraftPath = path.join(directory, "second-ui-draft.json");
      await writeFile(firstUiDraftPath, JSON.stringify(firstUiDraft), "utf8");
      await writeFile(secondUiDraftPath, JSON.stringify(secondUiDraft), "utf8");
      await executeCli(
        [
          "capture", "save", "--session", ui.id, "--kind", "ui-layout-draft",
          "--input", firstUiDraftPath, "--expected-revision", "0",
        ],
        dependencies,
      );
      await executeCli(
        [
          "capture", "save", "--session", ui.id, "--kind", "ui-layout-draft",
          "--input", secondUiDraftPath, "--expected-revision", "1",
        ],
        dependencies,
      );
      const undoneUi = await executeCli(
        [
          "capture", "undo", "--session", ui.id, "--kind", "ui-layout-draft",
          "--change-revision", "2", "--expected-revision", "2",
        ],
        dependencies,
      );
      expect(undoneUi).toMatchObject({ revision: 3, document: firstUiDraft });
    } finally {
      await server.close();
      database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reads typed captures, refines a composition, and exports its reference through HTTP", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-session-cli-"));
    const database = openDatabase(":memory:", migrationsDirectory);
    const projectSessions = new ProjectSessionRepository(database);
    const compositionSessions = new CompositionSessionRepository(database);
    const uiSketchSessions = new UiSketchSessionRepository(database);
    const server = buildServer(
      {},
      { compositionSessions, projectSessions, uiSketchSessions },
    );
    const dependencies: CliDependencies = {
      fetch: createServerFetch(server),
      serviceUrl: "http://human2ai.test",
    };

    try {
      const session = projectSessions.createSession({
        sessionType: "image-composition",
        title: "CLI 构图",
      });
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
      expect(draftFingerprint(draft)).toBe("draft-b797d011");
      const draftPath = path.join(directory, "draft.json");
      const planPath = path.join(directory, "plan.json");
      const stalePlanPath = path.join(directory, "stale-plan.json");
      const inspectionPreview = path.join(directory, "inspection.svg");
      const runOutput = path.join(directory, "run.json");
      const runPreview = path.join(directory, "refined.svg");
      const referenceOutput = path.join(directory, "composition-reference.png");
      const uiDraftPath = path.join(directory, "ui-draft.json");
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

      const compositionCaptures = (await executeCli(
        ["capture", "list", "--session", session.id],
        dependencies,
      )) as { captures: Array<{ versions: Array<Record<string, unknown>> }> };
      expect(compositionCaptures).toMatchObject({
        kind: "capture-list",
        sessionId: session.id,
        sessionType: "image-composition",
        captures: [{
          captureKind: "composition-draft",
          versions: [{ revision: 1, fingerprint: draftFingerprint(draft) }],
        }],
      });
      expect(compositionCaptures.captures[0].versions[0]).not.toHaveProperty("document");
      const compositionCapture = await executeCli(
        [
          "capture",
          "get",
          "--session",
          session.id,
          "--kind",
          "composition-draft",
          "--revision",
          "1",
        ],
        dependencies,
      );
      expect(compositionCapture).toMatchObject({
        kind: "capture-version",
        captureKind: "composition-draft",
        revision: 1,
        fingerprint: draftFingerprint(draft),
        document: draft,
      });

      const uiSession = projectSessions.createSession({
        sessionType: "ui-layout",
        title: "CLI UI 草图",
      });
      const uiDraft = createUiSketchDraft();
      uiDraft.overallNote = "首屏突出主要操作";
      await writeFile(uiDraftPath, JSON.stringify(uiDraft), "utf8");
      const savedUiCapture = await executeCli(
        [
          "capture",
          "save",
          "--session",
          uiSession.id,
          "--kind",
          "ui-layout-draft",
          "--input",
          uiDraftPath,
          "--expected-revision",
          "0",
        ],
        dependencies,
      );
      expect(savedUiCapture).toMatchObject({
        kind: "capture-version",
        sessionId: uiSession.id,
        sessionType: "ui-layout",
        captureKind: "ui-layout-draft",
        revision: 1,
        fingerprint: uiSketchDraftFingerprint(uiDraft),
        document: uiDraft,
      });
      const uiCaptures = await executeCli(
        ["capture", "list", "--session", uiSession.id],
        dependencies,
      );
      expect(uiCaptures).toMatchObject({
        captures: [{
          captureKind: "ui-layout-draft",
          versions: [{ revision: 1, fingerprint: uiSketchDraftFingerprint(uiDraft) }],
        }],
      });
      const fetchedUiCapture = await executeCli(
        [
          "capture",
          "get",
          "--session",
          uiSession.id,
          "--kind",
          "ui-layout-draft",
          "--revision",
          "1",
        ],
        dependencies,
      );
      expect(fetchedUiCapture).toMatchObject({ document: uiDraft });

      await expect(
        executeCli(
          [
            "capture",
            "get",
            "--session",
            uiSession.id,
            "--kind",
            "composition-draft",
            "--revision",
            "1",
          ],
          dependencies,
        ),
      ).rejects.toThrow(/does not provide capture kind composition-draft/i);

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

      const reference = (await executeCli(
        [
          "composition",
          "reference",
          "--session",
          session.id,
          "--run",
          applied.id,
          "--output",
          referenceOutput,
        ],
        dependencies,
      )) as {
        kind: string;
        sessionId: string;
        refinementRunId: string;
        sourceDraftRevision: number;
        artifact: {
          path: string;
          mimeType: string;
          width: number;
          height: number;
        };
      };
      expect(reference).toMatchObject({
        kind: "composition-reference",
        sessionId: session.id,
        refinementRunId: applied.id,
        sourceDraftRevision: 1,
        artifact: {
          path: referenceOutput,
          mimeType: "image/png",
          width: draft.frame.width,
          height: draft.frame.height,
        },
      });
      const referencePng = await readFile(referenceOutput);
      expect(referencePng.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(referencePng.readUInt32BE(16)).toBe(draft.frame.width);
      expect(referencePng.readUInt32BE(20)).toBe(draft.frame.height);

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
