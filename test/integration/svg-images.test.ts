import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ImageAssetRepository } from "../../src/database/image-asset-repository.js";
import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.js";
import { addCompositionImage, createDraft } from "../../src/domain/composition/index.js";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.js";
import { executeCli } from "../../src/cli/main.js";
import { buildServer } from "../../src/server/app.js";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32">
  <title>叶片 &amp; 轮廓</title>
  <defs><linearGradient id="leaf"><stop stop-color="#43845a"/></linearGradient></defs>
  <path d="M4 28 Q2 4 20 4 Q22 26 4 28Z" fill="url(#leaf)"/>
</svg>`;

describe("SVG image content", () => {
  let database: DatabaseConnection;
  let server: FastifyInstance;
  let directory: string;
  let sessionId: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "human2ai-svg-"));
    database = openDatabase(":memory:", resolve("migrations"));
    const projects = new ProjectSessionRepository(database);
    sessionId = projects.createSession({ sessionType: "ui-layout", title: "SVG" }).id;
    server = buildServer({}, {
      projectSessions: projects,
      imageAssets: new ImageAssetRepository(database, directory),
      compositionSessions: new CompositionSessionRepository(database),
      uiSketchSessions: new UiSketchSessionRepository(database),
    });
  });

  it.each(["image-composition", "ui-layout"] as const)("restores the previous SVG through capture undo in %s", async (sessionType) => {
    const session = new ProjectSessionRepository(database).createSession({ sessionType, title: "SVG history" });
    const images = new ImageAssetRepository(database, directory);
    const first = await images.create(session.id, { filename: "leaf.svg", data: Buffer.from(svg) });
    const updatedSource = svg.replace("#43845a", "#a34e21");
    const second = await images.create(session.id, { filename: "leaf.svg", data: Buffer.from(updatedSource) });
    const draft = sessionType === "image-composition"
      ? addCompositionImage(createDraft()).draft
      : { ...createUiSketchDraft(), images: [{
        id: "image-1", x: 320, y: 190, width: 120, height: 160, assetId: null as string | null,
        crop: null, origin: "agent" as const, note: "Keep this leaf", annotation: "", semanticType: "", visible: true, weight: "auto" as const,
      }] };
    const route = sessionType === "image-composition" ? "composition" : "ui-sketch";
    const draftsPath = `/api/v1/sessions/${session.id}/${route}/drafts`;
    draft.images[0].assetId = first.id;
    const saved = await server.inject({ method: "POST", url: draftsPath, payload: { expectedLatestRevision: 0, draft } });
    expect(saved.statusCode, saved.body).toBe(201);
    const original = saved.json().draft.images[0];
    draft.images[0].assetId = second.id;
    const replaced = await server.inject({ method: "POST", url: draftsPath, payload: { expectedLatestRevision: 1, draft } });
    expect(replaced.statusCode, replaced.body).toBe(201);
    const conflict = await server.inject({ method: "POST", url: draftsPath, payload: { expectedLatestRevision: 1, draft } });
    expect(conflict.statusCode).toBe(409);
    const undone = await server.inject({ method: "POST", url: `${draftsPath}/undo`, payload: { changeRevision: 2, expectedLatestRevision: 2 } });
    expect(undone.statusCode, undone.body).toBe(201);
    expect(undone.json()).toMatchObject({ revision: 3, draft: { images: [original] } });
    for (const [assetId, source] of [[first.id, svg], [second.id, updatedSource]]) {
      expect((await server.inject(`/api/v1/sessions/${session.id}/assets/${assetId}/content`)).body).toBe(source);
    }
    const connection = await executeCli(["session", "connect", "--session", session.id], {
      fetch: async (input) => {
        const response = await server.inject(new URL(String(input)).pathname);
        return new Response(response.body, { status: response.statusCode, headers: { "content-type": "application/json" } });
      },
    });
    expect(connection).toMatchObject({ images: { commands: {
      upload: expect.arrayContaining(["image", "upload", "--session", session.id]),
      source: expect.arrayContaining(["image", "source", "--asset", "<asset-id>"]),
    } } });
  });

  it("upgrades an existing image table without losing files or session ownership", async () => {
    const oldMigrations = join(directory, "old-migrations");
    await mkdir(oldMigrations);
    for (const name of await readdir(resolve("migrations"))) {
      if (/^000[1-6]_.*\.sql$/.test(name)) await copyFile(join(resolve("migrations"), name), join(oldMigrations, name));
    }
    const databasePath = join(directory, "previous.sqlite");
    const previous = openDatabase(databasePath, oldMigrations);
    const projects = new ProjectSessionRepository(previous);
    const session = projects.createSession({ sessionType: "ui-layout", title: "Existing" });
    previous.prepare(`INSERT INTO image_assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run("old-image", session.id, "old.png", "old.png", "image/png", 1, 24, 24, "abc", "now");
    previous.close();
    const upgraded = openDatabase(databasePath, resolve("migrations"));
    try {
      expect(upgraded.prepare("SELECT id, session_id, mime_type FROM image_assets").get())
        .toEqual({ id: "old-image", session_id: session.id, mime_type: "image/png" });
      await expect(new ImageAssetRepository(upgraded, directory).create(session.id, { filename: "leaf.svg", data: Buffer.from(svg) }))
        .resolves.toMatchObject({ mimeType: "image/svg+xml" });
      upgraded.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
      expect(upgraded.prepare("SELECT count(*) AS count FROM image_assets").get()).toEqual({ count: 0 });
    } finally {
      upgraded.close();
    }
  });

  afterEach(async () => {
    await server.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it.each(["image/svg+xml", "application/octet-stream"])("preserves complete SVG source uploaded as %s", async (contentType) => {
    const uploaded = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/assets?filename=leaf.svg`,
      headers: { "content-type": contentType },
      payload: Buffer.from(svg),
    });
    expect(uploaded.statusCode, uploaded.body).toBe(201);
    const asset = uploaded.json();
    expect(asset).toMatchObject({ mimeType: "image/svg+xml", width: 24, height: 32 });
    expect(await readFile(join(directory, sessionId, "source", `${asset.id}.svg`), "utf8")).toBe(svg);
    const content = await server.inject(`/api/v1/sessions/${sessionId}/assets/${asset.id}/content`);
    expect(content.statusCode).toBe(200);
    expect(content.headers["content-type"]).toContain("image/svg+xml");
    expect(content.headers["content-security-policy"]).toContain("sandbox");
    expect(content.headers["x-content-type-options"]).toBe("nosniff");
    expect(content.body).toBe(svg);
    const other = new ProjectSessionRepository(database).createSession({ sessionType: "image-composition", title: "Other" });
    expect((await server.inject(`/api/v1/sessions/${other.id}/assets/${asset.id}/content`)).statusCode).toBe(404);
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><image href="https://example.com/image.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><use href="file:///tmp/image.svg#leaf"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><style>@import "https://example.com/style.css";</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="url(https://example.com/paint.svg#x)"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text>&x;</text></svg>',
    '<?xml-stylesheet href="https://example.com/style.css"?><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>',
  ])("rejects malformed or non-self-contained SVG before storage: %s", async (source) => {
    const uploaded = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${sessionId}/assets?filename=input.svg`,
      headers: { "content-type": "application/octet-stream" },
      payload: Buffer.from(source),
    });
    expect(uploaded.statusCode, uploaded.body).toBe(400);
    expect(uploaded.json()).toMatchObject({ code: "INVALID_IMAGE_ASSET" });
    expect(database.prepare("SELECT count(*) AS count FROM image_assets").get()).toEqual({ count: 0 });
    expect(await readdir(directory, { recursive: true })).toEqual([]);
  });
});
