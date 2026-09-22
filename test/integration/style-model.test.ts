import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { openDatabase } from "../../src/database/migrate.ts";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.ts";
import { buildServer } from "../../src/server/app.ts";
import { styleModelGlb } from "../helpers/style-model.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const action of cleanup.splice(0)) await action(); });

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "style-model-"));
  const database = openDatabase(":memory:", resolve("migrations"));
  const repository = new StyleLibraryRepository(database, root);
  const server = buildServer({}, { styleLibrary: repository });
  cleanup.push(async () => { await server.close(); database.close(); await rm(root, { recursive: true, force: true }); });
  const style = repository.createStyle({ name: "Bricks", category: "spatial", creatorType: "agent", description: "Studs and plastic." });
  const url = `/api/v1/styles/${style.id}`;
  const upload = (revision: number, payload = styleModelGlb()) => server.inject({
    method: "POST", url: `${url}/model?filename=example.glb&expectedRevision=${revision}`,
    headers: { "content-type": "application/octet-stream" }, payload,
  });
  return { root, database, repository, server, style, url, upload };
}

it("persists one model, exposes it to Agents, replaces it without stale bytes, and cleans up", async () => {
  const { root, database, repository, server, style, url, upload } = await setup();
  const response = await upload(1);
  expect(response.statusCode, response.body).toBe(200);
  const first = response.json();
  expect(first).toMatchObject({ revision: 2, referenceImages: [], previewModel: { originalFilename: "example.glb" } });
  expect(repository.getStyle(style.id)).toEqual(first);
  const model = repository.getPreviewModel(style.id, first.previewModel.id);
  const content = `${url}/models/${first.previewModel.id}/content`;
  const downloaded = await server.inject({ method: "GET", url: content });
  expect(downloaded.headers["content-type"]).toBe("model/gltf-binary");
  expect(downloaded.rawPayload).toEqual(styleModelGlb());
  expect((await server.inject({ method: "GET", url: `/api/v1/agent/styles/${style.id}/context` })).json()).toEqual({
    description: style.description, referenceImages: [], previewModel: { url: content },
  });
  expect((await upload(1)).statusCode).toBe(409);
  expect(await readdir(join(root, "styles", style.id))).toHaveLength(1);
  const second = (await upload(2)).json();
  expect(second.revision).toBe(3);
  expect(second.previewModel.id).not.toBe(first.previewModel.id);
  expect(existsSync(model.filePath)).toBe(false);
  expect((await server.inject({ method: "GET", url: content })).statusCode).toBe(404);
  const wrongStyle = repository.createStyle({ name: "Other", category: "spatial", creatorType: "user", description: "Other." });
  expect((await server.inject({ method: "GET", url: `/api/v1/styles/${wrongStyle.id}/models/${second.previewModel.id}/content` })).statusCode).toBe(404);
  expect((await server.inject({ method: "DELETE", url: `${url}/model`, payload: { expectedRevision: 2 } })).statusCode).toBe(409);
  const removed = (await server.inject({ method: "DELETE", url: `${url}/model`, payload: { expectedRevision: 3 } })).json();
  expect(removed.revision).toBe(4);
  expect(removed.previewModel).toBeUndefined();
  expect(await readdir(join(root, "styles", style.id))).toEqual([]);
  await upload(4);
  await repository.deleteStyle(style.id, { expectedRevision: 5 });
  expect(database.prepare("SELECT * FROM style_preview_models").all()).toEqual([]);
  expect(existsSync(join(root, "styles", style.id))).toBe(false);
});

it("rejects invalid or externally dependent models without changing the existing example", async () => {
  const { repository, server, style, url, upload } = await setup();
  await upload(1);
  const before = repository.getStyle(style.id);
  const jsonUpload = await server.inject({ method: "POST", url: `${url}/model?filename=example.glb&expectedRevision=2`, payload: { fake: "model" } });
  expect(jsonUpload.statusCode).toBe(400);
  for (const data of [Buffer.from("not a model"), styleModelGlb().subarray(0, 40),
    styleModelGlb({ buffers: [{ byteLength: 36, uri: "https://example.com/model.bin" }] }),
    styleModelGlb({ images: [{ uri: "file:///tmp/image.png" }] }),
    styleModelGlb({ extensionsRequired: ["KHR_draco_mesh_compression"] }),
    styleModelGlb({ bufferViews: [{ buffer: 0, byteLength: 400 }] }), Buffer.alloc(10 * 1024 * 1024 + 1),
  ]) {
    const response = await upload(2, data);
    expect([400, 413], response.body).toContain(response.statusCode);
    expect(repository.getStyle(style.id)).toEqual(before);
  }
});

it("cleans up the losing file when two writers replace a model at the same revision", async () => {
  const { root, repository, style } = await setup();
  const outcomes = await Promise.allSettled([1, 2].map(() => repository.setPreviewModel(style.id, {
    expectedRevision: 1, filename: "example.glb", data: styleModelGlb(),
  })));
  expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  expect(repository.getStyle(style.id).revision).toBe(2);
  expect(await readdir(join(root, "styles", style.id))).toHaveLength(1);
});
