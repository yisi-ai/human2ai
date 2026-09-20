import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { ImageAssetRepository } from "../../src/database/image-asset-repository.js";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.js";
import {
  addCompositionImage,
  createDraft,
} from "../../src/domain/composition/index.js";
import { createUiSketchDraft } from "../../src/domain/ui-sketch/index.js";
import { buildServer } from "../../src/server/app.js";

const migrationsDirectory = path.resolve("migrations");
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("image asset API", () => {
  let database: DatabaseConnection | undefined;
  let server: FastifyInstance | undefined;
  let directory: string | undefined;

  afterEach(async () => {
    await server?.close();
    database?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("stores uploaded image bytes beside the database and serves them by asset id", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-image-assets-"));
    const artifactsDirectory = path.join(directory, "artifacts");
    database = openDatabase(":memory:", migrationsDirectory);
    const projects = new ProjectSessionRepository(database);
    server = buildServer({}, {
      projectSessions: projects,
      imageAssets: new ImageAssetRepository(database, artifactsDirectory),
    });
    const session = projects.createSession({
      sessionType: "image-composition",
      title: "图片构图",
    });

    const uploaded = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/assets?filename=portrait.png`,
      headers: { "content-type": "image/png" },
      payload: onePixelPng,
    });
    expect(uploaded.statusCode, uploaded.body).toBe(201);
    const asset = uploaded.json<{
      id: string;
      sessionId: string;
      originalFilename: string;
      mimeType: string;
      width: number;
      height: number;
    }>();
    expect(asset).toMatchObject({
      sessionId: session.id,
      originalFilename: "portrait.png",
      mimeType: "image/png",
      width: 1,
      height: 1,
    });
    expect(
      await readFile(path.join(artifactsDirectory, session.id, "source", `${asset.id}.png`)),
    ).toEqual(onePixelPng);

    const content = await server.inject({
      method: "GET",
      url: `/api/v1/sessions/${session.id}/assets/${asset.id}/content`,
    });
    expect(content.statusCode).toBe(200);
    expect(content.headers["content-type"]).toContain("image/png");
    expect(content.rawPayload).toEqual(onePixelPng);
  });

  it("rejects data that is not a supported image", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-invalid-image-"));
    database = openDatabase(":memory:", migrationsDirectory);
    const projects = new ProjectSessionRepository(database);
    server = buildServer({}, {
      projectSessions: projects,
      imageAssets: new ImageAssetRepository(database, path.join(directory, "artifacts")),
    });
    const session = projects.createSession({ sessionType: "ui-layout", title: "UI" });

    const response = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${session.id}/assets?filename=broken.png`,
      headers: { "content-type": "image/png" },
      payload: Buffer.from("not an image"),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_IMAGE_ASSET" });
  });

  it("syncs empty image nodes before an asset is uploaded", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-empty-image-node-"));
    database = openDatabase(":memory:", migrationsDirectory);
    const projects = new ProjectSessionRepository(database);
    server = buildServer({}, {
      projectSessions: projects,
      compositionSessions: new CompositionSessionRepository(database),
      uiSketchSessions: new UiSketchSessionRepository(database),
    });

    const compositionSession = projects.createSession({
      sessionType: "image-composition",
      title: "空图片构图",
    });
    const compositionDraft = addCompositionImage(createDraft()).draft;
    const compositionResponse = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${compositionSession.id}/composition/drafts`,
      payload: { expectedLatestRevision: 0, draft: compositionDraft },
    });
    expect(compositionResponse.statusCode, compositionResponse.body).toBe(201);
    expect(compositionResponse.json().draft.images[0].assetId).toBeNull();

    const uiSession = projects.createSession({
      sessionType: "ui-layout",
      title: "空图片 UI",
    });
    const uiDraft = createUiSketchDraft();
    uiDraft.images.push({
      id: "image-1",
      x: 320,
      y: 190,
      width: 320,
      height: 180,
      assetId: null,
      crop: null,
      note: "",
      annotation: "",
      semanticType: "",
      origin: "user",
      visible: true,
      weight: "auto",
    });
    const uiResponse = await server.inject({
      method: "POST",
      url: `/api/v1/sessions/${uiSession.id}/ui-sketch/drafts`,
      payload: { expectedLatestRevision: 0, draft: uiDraft },
    });
    expect(uiResponse.statusCode, uiResponse.body).toBe(201);
    expect(uiResponse.json().draft.images[0].assetId).toBeNull();
  });
});
