import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeCli, type CliDependencies } from "../../src/cli/main.ts";
import { CompositionSessionRepository } from "../../src/database/composition-session-repository.ts";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.ts";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.ts";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.ts";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.ts";
import { SpatialSessionRepository } from "../../src/database/spatial-session-repository.ts";
import { createDraft } from "../../src/domain/composition/index.ts";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";
import { createSpatialDraft } from "../../src/domain/spatial/index.ts";
import { styleModelGlb } from "../helpers/style-model.ts";
import { buildServer } from "../../src/server/app.ts";

describe.each([
  { type: "image-composition" as const, path: "composition", draft: createDraft },
  { type: "ui-layout" as const, path: "ui-sketch", draft: createUiSketchDraft },
  { type: "spatial" as const, path: "spatial", draft: createSpatialDraft },
])("$type session styles", (harness) => {
  let database: DatabaseConnection;
  let directory: string;
  let server: ReturnType<typeof buildServer>;

  afterEach(async () => {
    await server?.close();
    database?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function setup() {
    directory = await mkdtemp(join(tmpdir(), "human2ai-session-style-"));
    database = openDatabase(":memory:", resolve("migrations"));
    const projects = new ProjectSessionRepository(database);
    const styles = new StyleLibraryRepository(database, directory);
    const session = projects.createSession({ sessionType: harness.type, title: "Canvas" });
    const style = styles.createStyle({
      name: "Whitespace", category: harness.type === "spatial" ? "spatial" : harness.type === "ui-layout" ? "ui" : "visual",
      creatorType: "agent", description: "Use generous whitespace. Preserve the user's content.",
    });
    server = buildServer({}, {
      projectSessions: projects, styleLibrary: styles,
      compositionSessions: new CompositionSessionRepository(database),
      uiSketchSessions: new UiSketchSessionRepository(database),
      spatialSessions: new SpatialSessionRepository(database),
    });
    return { session, style, styles };
  }

  it("shares binding with the browser, detects conflicts and clears deleted styles", async () => {
    const { session, style, styles } = await setup();
    const url = `/api/v1/sessions/${session.id}/style`;
    const draftsUrl = `/api/v1/sessions/${session.id}/${harness.path}/drafts`;
    const before = await server.inject({ method: "POST", url: draftsUrl, payload: { expectedLatestRevision: 0, draft: harness.draft() } });
    expect(before.statusCode, before.body).toBe(201);
    const bind = await server.inject({ method: "PATCH", url, payload: { styleId: style.id, expectedRevision: 1 } });
    expect(bind.statusCode, bind.body).toBe(200);
    expect(bind.json()).toMatchObject({ session: { styleId: style.id, revision: 2 }, style: { id: style.id, promptSummary: "Use generous whitespace." } });
    expect((await server.inject({ method: "GET", url })).json()).toEqual(bind.json());
    expect((await server.inject({ method: "PATCH", url, payload: { styleId: style.id, expectedRevision: 2 } })).json()).toEqual(bind.json());
    expect((await server.inject({ method: "GET", url: `${draftsUrl}/1` })).json()).toEqual(before.json());
    expect((await server.inject({ method: "PATCH", url, payload: { styleId: null, expectedRevision: 1 } })).statusCode).toBe(409);
    await styles.deleteStyle(style.id, { expectedRevision: style.revision });
    expect((await server.inject({ method: "GET", url })).json()).toMatchObject({ session: { styleId: null, revision: 3 }, style: null });
  });

  it("records style processing, preserves it across user edits and restores it on undo", async () => {
    const { session, style } = await setup();
    await server.inject({ method: "PATCH", url: `/api/v1/sessions/${session.id}/style`, payload: { styleId: style.id, expectedRevision: 1 } });
    const url = `/api/v1/sessions/${session.id}/${harness.path}/drafts`;
    const first = await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 0, draft: harness.draft() } });
    expect(first.statusCode, first.body).toBe(201);
    const processed = await server.inject({ method: "POST", url, payload: {
      expectedLatestRevision: 1, draft: { ...harness.draft(), ...(harness.type === "spatial" ? { lightingEnabled: true } : { overallNote: "User content" }) },
      styleProcessing: { styleId: style.id, styleRevision: 1, sessionRevision: 2 },
    } });
    expect(processed.statusCode, processed.body).toBe(201);
    expect(processed.json().styleProcessing).toEqual({ styleId: style.id, styleRevision: 1, sourceRevision: 1, resultRevision: 2 });
    const edited = await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 2, draft: { ...harness.draft(), ...(harness.type === "spatial" ? { lightingEnabled: false } : { overallNote: "User revision" }) } } });
    expect(edited.json().styleProcessing).toEqual(processed.json().styleProcessing);
    const undoEdit = await server.inject({ method: "POST", url: `${url}/undo`, payload: { changeRevision: 3, expectedLatestRevision: 3 } });
    expect(undoEdit.json().draft).toEqual(processed.json().draft);
    expect(undoEdit.json().styleProcessing).toEqual(processed.json().styleProcessing);
    const history = await server.inject({ method: "GET", url });
    expect(history.json().draftVersions).toHaveLength(4);
  });

  it("restores the absence of style processing when the first processing is undone", async () => {
    const { session, style } = await setup();
    await server.inject({ method: "PATCH", url: `/api/v1/sessions/${session.id}/style`, payload: { styleId: style.id, expectedRevision: 1 } });
    const url = `/api/v1/sessions/${session.id}/${harness.path}/drafts`;
    await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 0, draft: harness.draft() } });
    await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 1, draft: harness.draft(), styleProcessing: { styleId: style.id, styleRevision: 1, sessionRevision: 2 } } });
    const undo = await server.inject({ method: "POST", url: `${url}/undo`, payload: { changeRevision: 2, expectedLatestRevision: 2 } });
    expect(undo.statusCode, undo.body).toBe(201);
    expect(undo.json()).not.toHaveProperty("styleProcessing");
    const edit = await server.inject({ method: "POST", url, payload: { expectedLatestRevision: 3, draft: harness.draft() } });
    expect(edit.json()).not.toHaveProperty("styleProcessing");
  });

  it("lets an Agent select, bind, discover the specification and save an editable styled capture", async () => {
    const { session, style, styles } = await setup();
    const modeled = harness.type === "spatial" ? await styles.setPreviewModel(style.id, {
      expectedRevision: 1, filename: "example.glb", data: styleModelGlb(),
    }) : style;
    const dependencies: CliDependencies = {
      fetch: async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        const response = await server.inject({
          method: (init?.method ?? "GET") as "GET" | "POST" | "PATCH",
          url: `${url.pathname}${url.search}`,
          payload: typeof init?.body === "string" ? init.body : undefined,
          headers: { "content-type": "application/json" },
        });
        return new Response(response.body, { status: response.statusCode, headers: { "content-type": "application/json" } });
      },
    };
    expect(await executeCli(["style", "list"], dependencies)).toMatchObject({ styles: [expect.objectContaining({ id: style.id })] });
    await executeCli(["session", "bind-style", "--session", session.id, "--style", style.id, "--expected-revision", "1"], dependencies);
    const connection = await executeCli(["session", "connect", "--session", session.id], dependencies) as { style: { commands: { save: string[] } } };
    expect(connection).toMatchObject({ style: { current: { id: style.id, description: style.description, promptSummary: style.promptSummary, referenceImages: [] } } });
    if (modeled.previewModel) expect(connection).toMatchObject({ style: { current: {
      previewModel: { url: `http://127.0.0.1:4180/api/v1/styles/${style.id}/models/${modeled.previewModel.id}/content` },
    } } });
    const inputPath = join(directory, "styled.json");
    await writeFile(inputPath, JSON.stringify(harness.draft()));
    const command = connection.style.commands.save.map((arg) => arg === "<document.json>" ? inputPath : arg);
    const saved = await executeCli(command, dependencies);
    expect(saved).toMatchObject({ revision: 1, document: harness.draft(), styleProcessing: { styleId: style.id, styleRevision: modeled.revision, sourceRevision: 0, resultRevision: 1 } });
    await expect(executeCli(command, dependencies)).rejects.toMatchObject({ code: "DRAFT_REVISION_CONFLICT" });
    const browser = await server.inject({ method: "GET", url: `/api/v1/sessions/${session.id}/${harness.path}/drafts/1` });
    expect(browser.json()).toMatchObject({ draft: harness.draft(), styleProcessing: { resultRevision: 1 } });
    await executeCli(["session", "unbind-style", "--session", session.id, "--expected-revision", "2"], dependencies);
    expect(await executeCli(["session", "style", "--session", session.id], dependencies)).toMatchObject({ session: { styleId: null }, style: null });
    expect((await server.inject({ method: "GET", url: `/api/v1/sessions/${session.id}/${harness.path}/drafts/1` })).json()).toEqual(browser.json());
  });

  it("rejects processing after the binding, style rules or source canvas change", async () => {
    const { session, style, styles } = await setup();
    const bindingUrl = `/api/v1/sessions/${session.id}/style`;
    await server.inject({ method: "PATCH", url: bindingUrl, payload: { styleId: style.id, expectedRevision: 1 } });
    const url = `/api/v1/sessions/${session.id}/${harness.path}/drafts`;
    const payload = { expectedLatestRevision: 0, draft: harness.draft(), styleProcessing: { styleId: style.id, styleRevision: 1, sessionRevision: 2 } };
    styles.updateStyle(style.id, { expectedRevision: 1, description: "Use tighter spacing." });
    const staleStyle = await server.inject({ method: "POST", url, payload });
    expect(staleStyle.statusCode, staleStyle.body).toBe(409);
    expect(staleStyle.json().code).toBe("STYLE_PROCESSING_STALE");
    await server.inject({ method: "PATCH", url: bindingUrl, payload: { styleId: null, expectedRevision: 2 } });
    expect((await server.inject({ method: "POST", url, payload: { ...payload, styleProcessing: { ...payload.styleProcessing, styleRevision: 2 } } })).statusCode).toBe(409);
    expect((await server.inject({ method: "GET", url })).json().draftVersions).toEqual([]);
  });
});
