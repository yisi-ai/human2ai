import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeCli } from "../../src/cli/main.js";
import { ImageAssetRepository } from "../../src/database/image-asset-repository.js";
import { openDatabase } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.js";
import { createUiSketchDraft, deleteUiSketchState, insertUiSketchStage, renameUiSketchState, reorderUiSketchStates, validateUiSketchDraft } from "../../src/domain/ui-sketch/index.js";
import { buildServer } from "../../src/server/app.js";

async function workspace() {
  const directory = await mkdtemp(path.join(tmpdir(), "human2ai-ui-preview-"));
  const database = openDatabase(":memory:", path.resolve("migrations"));
  const projectSessions = new ProjectSessionRepository(database);
  const uiSketchSessions = new UiSketchSessionRepository(database);
  const imageAssets = new ImageAssetRepository(database, directory);
  const server = buildServer({}, { projectSessions, uiSketchSessions, imageAssets });
  const session = projectSessions.createSession({ sessionType: "ui-layout", title: "UI preview" });
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const url = new URL(input instanceof Request ? input.url : String(input));
    const response = await server.inject({ method: "GET", url: url.pathname + url.search });
    return new Response(new Uint8Array(response.rawPayload), {
      status: response.statusCode,
      headers: { "content-type": String(response.headers["content-type"]) },
    });
  });
  const openUrl = vi.fn(async () => { throw new Error("Rendering must not open a browser"); });
  return { directory, database, projectSessions, uiSketchSessions, imageAssets, server, session,
    dependencies: { fetch: fetcher, openUrl, serviceUrl: "http://human2ai-preview.test" } };
}

describe("UI layout CLI preview", () => {
  let env: Awaited<ReturnType<typeof workspace>>;
  beforeEach(async () => { env = await workspace(); });
  afterEach(async () => {
    await env.server.close(); env.database.close();
    await rm(env.directory, { recursive: true, force: true });
  });

  it("discovers and exports one immutable revision as self-contained SVG and cropped PNG without browser access", async () => {
    const raster = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), { raw: { width: 2, height: 1, channels: 3 } }).png().toBuffer();
    const bitmap = await env.imageAssets.create(env.session.id, { filename: "colors.png", data: raster });
    const vector = await env.imageAssets.create(env.session.id, { filename: "blue.svg", data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0000ff"/></svg>') });
    const draft = validateUiSketchDraft({ ...createUiSketchDraft(),
      frame: { x: 100, y: 200, width: 64, height: 48 },
      rectangles: [
        { id: "region", x: 110, y: 210, width: 20, height: 20, note: "" },
        { id: "outside", x: 200, y: 200, width: 20, height: 20 },
      ],
      texts: [{ id: "label", x: 105, y: 235, fontSize: 6, text: "A < B & C" }],
      images: [
        { id: "bitmap", x: 114, y: 214, width: 8, height: 8, assetId: bitmap.id, crop: { x: 0.5, y: 0, width: 0.5, height: 1 } },
        { id: "vector", x: 140, y: 210, width: 8, height: 8, assetId: vector.id },
        { id: "hidden", x: 100, y: 200, width: 8, height: 8, assetId: "not-fetched", visible: false },
      ],
      layerOrder: ["region", "outside", "bitmap", "vector", "label", "hidden"],
    });
    const version = env.uiSketchSessions.createDraftVersion(env.session.id, { draft, expectedLatestRevision: 0 });
    env.uiSketchSessions.createDraftVersion(env.session.id, { draft: { ...draft, texts: [] }, expectedLatestRevision: 1 });
    const connection = await executeCli(["session", "connect", "--session", env.session.id], env.dependencies) as { operations: Array<{ id: string; command: string[] }> };
    const operation = connection.operations.find(item => item.id === "ui-layout.render@1")!;
    expect(operation).toMatchObject({ mode: "artifact", sessionScoped: true, sourceCaptureKind: "ui-layout-draft" });
    const svgPath = path.join(env.directory, "preview.svg");
    const command = operation.command.map(value => ({ "<revision>": "1", "<state-id>": "start", "<preview.png>": svgPath })[value] ?? value);
    const result = await executeCli(command, env.dependencies);
    expect(result).toMatchObject({ kind: "ui-layout-preview", sessionId: env.session.id, revision: 1, fingerprint: version.fingerprint,
      state: { id: "start", number: 1 }, artifact: { path: svgPath, mimeType: "image/svg+xml", width: 64, height: 48 } });
    const svg = await readFile(svgPath, "utf8");
    expect(svg).toContain("A &lt; B &amp; C");
    expect(svg).toContain("data:image/png;base64,");
    expect(svg).toContain("data:image/svg+xml;base64,");
    expect(svg).not.toContain('href="http');
    const pngPath = path.join(env.directory, "preview.png");
    await executeCli(["ui-layout", "render", "--session", env.session.id, "--revision", "1", "--output", pngPath], env.dependencies);
    const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
    expect(info).toMatchObject({ width: 64, height: 48 });
    expect(pixel(18, 18)).toEqual([0, 255, 0, 255]);
    expect(pixel(44, 14)).toEqual([0, 0, 255, 255]);
    expect(pixel(60, 4)).toEqual([255, 255, 255, 255]);
    expect(env.uiSketchSessions.listDraftVersions(env.session.id)).toHaveLength(2);
    expect(env.dependencies.openUrl).not.toHaveBeenCalled();
  });

  it("selects named states by stable id and defaults to display order after start is deleted", async () => {
    let draft = validateUiSketchDraft({ ...createUiSketchDraft(), rectangles: [{ id: "region", x: 10, y: 20, width: 30, height: 40 }] });
    draft = insertUiSketchStage(draft, "start", "expanded");
    draft = insertUiSketchStage(draft, "expanded", "closed");
    draft.stages[0].rectangles[0].x = 123;
    draft.stages[1].rectangles[0].visible = false;
    draft = renameUiSketchState(draft, "expanded", "展开");
    draft = deleteUiSketchState(reorderUiSketchStates(draft, ["closed", "expanded", "start"]), "start");
    env.uiSketchSessions.createDraftVersion(env.session.id, { draft, expectedLatestRevision: 0 });
    const output = path.join(env.directory, "state.svg");
    const command = ["ui-layout", "render", "--session", env.session.id, "--revision", "1", "--output", output];
    await expect(executeCli(command, env.dependencies)).resolves.toMatchObject({ state: { id: "closed" } });
    expect(await readFile(output, "utf8")).not.toContain('x="10"');
    await expect(executeCli([...command, "--state", "expanded"], env.dependencies)).resolves.toMatchObject({ state: { id: "expanded", name: "展开" } });
    expect(await readFile(output, "utf8")).toContain('x="123"');
    const saved = await readFile(output, "utf8");
    for (const state of ["start", "missing", "展开"]) {
      await expect(executeCli([...command, "--state", state], env.dependencies)).rejects.toThrow("Unknown UI state");
    }
    expect(await readFile(output, "utf8")).toBe(saved);
  });

  it("rejects wrong session types, missing revisions and unsupported output formats", async () => {
    const output = path.join(env.directory, "preview.png");
    const composition = env.projectSessions.createSession({ sessionType: "image-composition", title: "Wrong type" });
    const command = ["ui-layout", "render", "--session", env.session.id, "--revision", "1", "--output", output];
    await expect(executeCli(command, env.dependencies)).rejects.toMatchObject({ code: "DRAFT_VERSION_NOT_FOUND" });
    await expect(executeCli(command.map(value => value === env.session.id ? composition.id : value), env.dependencies)).rejects.toThrow("does not provide capture kind ui-layout-draft");
    await expect(executeCli(command.map(value => value === output ? output + ".jpg" : value), env.dependencies)).rejects.toThrow(".png or .svg");
    await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
