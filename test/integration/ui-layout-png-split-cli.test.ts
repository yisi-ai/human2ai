import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeCli } from "../../src/cli/main.ts";
import { openDatabase } from "../../src/database/migrate.ts";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.ts";
import { ImageAssetRepository } from "../../src/database/image-asset-repository.ts";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.ts";
import { UiSketchPngSplitRepository } from "../../src/database/ui-sketch-png-split-repository.ts";
import { createUiSketchDraft, insertUiSketchStage, validateUiSketchDraft } from "../../src/domain/ui-sketch/index.ts";
import type { PngSplitBatch } from "../../src/domain/ui-sketch/png-split.ts";
import { buildServer } from "../../src/server/app.ts";

async function workspace() {
  const directory = await mkdtemp(path.join(tmpdir(), "human2ai-split-cli-"));
  const database = openDatabase(":memory:", path.resolve("migrations"));
  const projects = new ProjectSessionRepository(database);
  const assets = new ImageAssetRepository(database, path.join(directory, "assets"));
  const sessions = new UiSketchSessionRepository(database);
  const splits = new UiSketchPngSplitRepository(database, assets);
  const server = buildServer({}, { projectSessions: projects, imageAssets: assets, uiSketchSessions: sessions, pngSplits: splits });
  const session = projects.createSession({ title: "Split CLI", sessionType: "ui-layout" });
  const rgba = Buffer.alloc(70 * 24 * 4);
  for (const [x, y, w, h] of [[1, 1, 15, 15], [20, 1, 16, 1], [40, 1, 1, 16], [45, 1, 17, 17]]) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) rgba.set([12, 34, 56, 255], (yy * 70 + xx) * 4);
  }
  const bytes = await sharp(rgba, { raw: { width: 70, height: 24, channels: 4 } }).png().toBuffer();
  const asset = await assets.create(session.id, { filename: "source.png", data: bytes });
  const draft = insertUiSketchStage(validateUiSketchDraft({ ...createUiSketchDraft(),
    overallNote: "keep instructions", rectangles: [{ id: "unrelated", x: 0, y: 0, width: 50, height: 20, note: "keep" }],
    images: [{ id: "source", assetId: asset.id, x: 5, y: 8, width: 7, height: 2.4, note: "original",
      crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } }], layerOrder: ["unrelated", "source"],
  }), "start", "second");
  sessions.createDraftVersion(session.id, { draft, expectedLatestRevision: 0 });
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const response = await server.inject({ method: (init?.method ?? "GET") as "GET" | "POST", url: url.pathname + url.search,
      ...(init?.body ? { payload: JSON.parse(String(init.body)) } : {}) });
    return new Response(new Uint8Array(response.rawPayload), { status: response.statusCode,
      headers: { "content-type": String(response.headers["content-type"]) } });
  });
  const openUrl = vi.fn(async () => { throw new Error("Splitting must not open a browser"); });
  const command = (revision = 1, preview = false) => ["ui-layout", preview ? "preview-png-split" : "split-png",
    "--session", session.id, "--revision", String(revision), "--node", "source"];
  return { directory, database, projects, assets, sessions, server, session, draft, asset, bytes, command,
    dependencies: { fetch: fetcher, openUrl, serviceUrl: "http://human2ai-split.test" } };
}

interface SplitResult {
  changed: boolean;
  capture: { revision: number };
  batch: PngSplitBatch;
}

describe("UI layout PNG split CLI", () => {
  let env: Awaited<ReturnType<typeof workspace>>;
  beforeEach(async () => { env = await workspace(); });
  afterEach(async () => { vi.restoreAllMocks(); await env.server.close(); env.database.close(); await rm(env.directory, { recursive: true, force: true }); });

  it("discovers the operation, exports original PNG bytes and saves native-size grouped slices in every state", async () => {
    const output = path.join(env.directory, "original.png");
    await executeCli(["image", "source", "--session", env.session.id, "--asset", env.asset.id, "--output", output], env.dependencies);
    expect(await readFile(output)).toEqual(env.bytes);
    const connection = await executeCli(["session", "connect", "--session", env.session.id], env.dependencies) as {
      operations: Array<{ id: string; mode: string; command: string[] }>;
    };
    const operation = connection.operations.find(item => item.id === "ui-layout.split-png@1")!;
    expect(operation.mode).toBe("derive");
    expect(connection.operations.find(item => item.id === "ui-layout.preview-png-split@1")?.mode).toBe("read");
    const uploads = vi.spyOn(env.assets, "create");
    const result = await executeCli(operation.command.map(value => ({ "<revision>": "1", "<image-node-id>": "source" })[value] ?? value), env.dependencies) as SplitResult;
    expect(result).toMatchObject({ changed: true, capture: { revision: 2 }, batch: { options: { alphaThreshold: 8, minSize: 16, gap: 12 } } });
    expect(uploads).toHaveBeenCalledTimes(3);
    const saved = env.sessions.getLatestDraftVersion(env.session.id)!.draft;
    expect(saved.images[0]).toEqual(env.draft.images[0]);
    expect(saved.rectangles).toEqual(env.draft.rectangles);
    expect(saved.overallNote).toBe(env.draft.overallNote);
    expect(saved.images.slice(1).map(image => [image.width, image.height])).toEqual([[16, 1], [1, 16], [17, 17]]);
    expect(saved.images.slice(1).every(image => image.x >= saved.frame.x + saved.frame.width + 24 && image.y >= saved.frame.y)).toBe(true);
    expect(saved.groups).toEqual([{ id: result.batch.groupId, itemIds: result.batch.pieces.map(piece => piece.nodeId) }]);
    expect(saved.stages[0].images).toHaveLength(4);
    expect(saved.layerOrder!.slice(0, 2)).toEqual(env.draft.layerOrder);
    expect(saved.pngSplits).toEqual([result.batch]);
    expect(env.dependencies.openUrl).not.toHaveBeenCalled();
  });

  it("repeats without uploads, new revisions, restored deletions or moving edited nodes", async () => {
    await executeCli(env.command(), env.dependencies);
    const edited = env.sessions.getLatestDraftVersion(env.session.id)!.draft;
    const removed = edited.images.pop()!.id;
    edited.groups = []; edited.layerOrder = edited.layerOrder!.filter(id => id !== removed);
    edited.stages[0].images = edited.stages[0].images.filter(image => image.id !== removed);
    Object.assign(edited.images[1], { x: -100, note: "chosen", visible: false });
    env.sessions.createDraftVersion(env.session.id, { draft: edited, expectedLatestRevision: 2 });
    const uploads = vi.spyOn(env.assets, "create");
    await expect(executeCli([...env.command(3), "--gap", "20", "--x", "999"], env.dependencies))
      .resolves.toMatchObject({ changed: false, capture: { revision: 3 }, batch: null });
    expect(uploads).not.toHaveBeenCalled();
    expect(env.sessions.listDraftVersions(env.session.id)).toHaveLength(3);
    expect(env.sessions.getLatestDraftVersion(env.session.id)!.draft).toEqual(edited);
  });

  it("previews without mutation and applies the same manual regions and custom parameters", async () => {
    const regions = path.join(env.directory, "regions.json");
    await writeFile(regions, JSON.stringify([[[0, 0], [18, 0], [18, 18], [0, 18]]]));
    const params = ["--alpha-threshold", "0", "--min-size", "100", "--gap", "0", "--regions", regions];
    const uploads = vi.spyOn(env.assets, "create");
    await expect(executeCli([...env.command(1, true), ...params], env.dependencies)).resolves.toMatchObject({
      kind: "ui-layout-png-split-preview", revision: 1, sources: [{ nodeId: "source", rects: [[1, 1, 15, 15]], discarded: 3 }],
    });
    expect(uploads).not.toHaveBeenCalled();
    expect(env.database.prepare("SELECT * FROM ui_sketch_png_splits").all()).toEqual([]);
    expect(env.sessions.listDraftVersions(env.session.id)).toHaveLength(1);
    const result = await executeCli([...env.command(), ...params, "--x", "-50.5", "--y", "200"], env.dependencies) as SplitResult;
    expect(result.batch.pieces.map(piece => piece.sourceRect)).toEqual([[1, 1, 15, 15]]);
    const saved = env.sessions.getLatestDraftVersion(env.session.id)!.draft;
    expect(saved.images[1]).toMatchObject({ x: -50.5, y: 200, width: 15, height: 15 });
    expect(saved.groups).toEqual([]);
    expect(saved.pngSplits![0].sources[0].regions).toEqual(JSON.parse(await readFile(regions, "utf8")));
  });

  it("stops on a save conflict, retries prepared assets against current edits and supports capture undo", async () => {
    let interrupt = true;
    const dependencies = { ...env.dependencies, fetch: async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (interrupt && init?.method === "POST" && String(input).endsWith("/ui-sketch/drafts")) {
        interrupt = false;
        env.sessions.createDraftVersion(env.session.id, { expectedLatestRevision: 1, draft: { ...env.draft, overallNote: "external edit" } });
      }
      return env.dependencies.fetch(input, init);
    } };
    await expect(executeCli(env.command(), dependencies)).rejects.toMatchObject({ code: "DRAFT_REVISION_CONFLICT", status: 409 });
    expect(env.sessions.getLatestDraftVersion(env.session.id)!.draft).toMatchObject({ overallNote: "external edit", images: env.draft.images });
    const uploads = vi.spyOn(env.assets, "create");
    await expect(executeCli(env.command(2), dependencies)).resolves.toMatchObject({ changed: true, capture: { revision: 3 } });
    expect(uploads).not.toHaveBeenCalled();
    expect(env.sessions.getLatestDraftVersion(env.session.id)!.draft.overallNote).toBe("external edit");
    await executeCli(["capture", "undo", "--session", env.session.id, "--kind", "ui-layout-draft",
      "--change-revision", "3", "--expected-revision", "3"], env.dependencies);
    expect(env.sessions.getLatestDraftVersion(env.session.id)!.draft).toEqual({ ...env.draft, overallNote: "external edit" });
  });

  it("records a zero-piece result once and leaves source images intact", async () => {
    await expect(executeCli([...env.command(), "--min-size", "100"], env.dependencies)).resolves.toMatchObject({
      changed: true, batch: { pieces: [], groupId: null }, capture: { revision: 2 },
    });
    expect(env.sessions.getLatestDraftVersion(env.session.id)!.draft.images).toEqual(env.draft.images);
    await expect(executeCli([...env.command(2), "--min-size", "100"], env.dependencies)).resolves.toMatchObject({ changed: false });
    expect(env.sessions.listDraftVersions(env.session.id)).toHaveLength(2);
  });

  it("rejects stale revisions, missing nodes, wrong session types and invalid parameters without preparing assets", async () => {
    env.sessions.createDraftVersion(env.session.id, { draft: env.draft, expectedLatestRevision: 1 });
    const uploads = vi.spyOn(env.assets, "create");
    await expect(executeCli(env.command(), env.dependencies)).rejects.toMatchObject({ code: "DRAFT_REVISION_CONFLICT", details: { actualLatestRevision: 2 } });
    await expect(executeCli(env.command(2).map(value => value === "source" ? "missing" : value), env.dependencies)).rejects.toMatchObject({ code: "INVALID_IMAGE_ASSET" });
    const other = env.projects.createSession({ title: "wrong", sessionType: "image-composition" });
    await expect(executeCli(env.command().map(value => value === env.session.id ? other.id : value), env.dependencies)).rejects.toThrow("ui-layout-draft");
    for (const args of [["--alpha-threshold", "255"], ["--min-size", "1.5"], ["--gap", "-1"], ["--x", "NaN"], ["--y", "Infinity"]]) {
      await expect(executeCli([...env.command(2), ...args], env.dependencies)).rejects.toThrow();
    }
    expect(uploads).not.toHaveBeenCalled();
    expect(env.database.prepare("SELECT * FROM ui_sketch_png_splits").all()).toEqual([]);
    expect(env.sessions.listDraftVersions(env.session.id)).toHaveLength(2);
  });
});
