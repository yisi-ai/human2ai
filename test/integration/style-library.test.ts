import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.js";
import { buildServer } from "../../src/server/app.js";

const migrationsDirectory = path.resolve("migrations");
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("style library API", () => {
  let database: DatabaseConnection | undefined;
  let server: FastifyInstance | undefined;
  let directory: string | undefined;

  afterEach(async () => {
    await server?.close();
    database?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function setup(): Promise<string> {
    directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-style-library-"));
    const artifactsDirectory = path.join(directory, "artifacts");
    database = openDatabase(":memory:", migrationsDirectory);
    server = buildServer({}, {
      styleLibrary: new StyleLibraryRepository(database, artifactsDirectory),
    });
    return artifactsDirectory;
  }

  it("stores a concise prompt sentence separately and provides a legacy fallback", async () => {
    await setup();
    const description = "Use quiet whitespace and precise alignment.\nKeep the primary action prominent.";
    const created = await server!.inject({ method: "POST", url: "/api/v1/styles", payload: {
      name: "Quiet UI", category: "ui", description, promptSummary: " Calm whitespace,\n precise alignment. ",
    } });
    expect(created.statusCode, created.body).toBe(201);
    const style = created.json();
    expect(style).toMatchObject({ description, promptSummary: "Calm whitespace, precise alignment." });
    const url = `/api/v1/styles/${style.id}`;
    const updated = await server!.inject({ method: "PATCH", url, payload: { expectedRevision: 1, promptSummary: "Sparse layout with a strong primary action." } });
    expect(updated.json()).toMatchObject({ revision: 2, description, promptSummary: "Sparse layout with a strong primary action." });
    expect((await server!.inject({ method: "PATCH", url, payload: { expectedRevision: 2, promptSummary: " " } })).statusCode).toBe(400);
    expect((await server!.inject({ method: "PATCH", url, payload: { expectedRevision: 2, promptSummary: "a".repeat(241) } })).statusCode).toBe(400);
    database!.prepare("UPDATE style_entries SET prompt_summary = NULL WHERE id = ?").run(style.id);
    expect((await server!.inject({ method: "GET", url })).json()).toMatchObject({ description, promptSummary: "Use quiet whitespace and precise alignment." });
  });

  it("fixes the creator from the browser or Agent creation entry point", async () => {
    await setup();

    const userResponse = await server!.inject({
      method: "POST",
      url: "/api/v1/styles",
      payload: {
        name: "低饱和画面",
        category: "visual",
        description: "压低饱和度，以冷灰层次保持安静的电影感。",
      },
    });
    expect(userResponse.statusCode, userResponse.body).toBe(201);
    expect(userResponse.json()).toMatchObject({
      category: "visual",
      creatorType: "user",
      referenceImages: [],
      revision: 1,
    });

    const agentResponse = await server!.inject({
      method: "POST",
      url: "/api/v1/agent/styles",
      payload: {
        name: "克制型后台界面",
        category: "ui",
        description: "弱化容器边界，使用间距、字重和对齐表达层级。",
      },
    });
    expect(agentResponse.statusCode, agentResponse.body).toBe(201);
    const agentStyle = agentResponse.json<{ id: string; revision: number }>();

    const updated = await server!.inject({
      method: "PATCH",
      url: `/api/v1/styles/${agentStyle.id}`,
      payload: {
        expectedRevision: agentStyle.revision,
        description: "弱化容器边界，以间距、字重、对齐和留白表达层级。",
      },
    });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json()).toMatchObject({ creatorType: "agent", revision: 2 });

    const list = await server!.inject({ method: "GET", url: "/api/v1/styles" });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ styles: unknown[] }>().styles).toHaveLength(2);
  });

  it("stores optional reference images and exposes only references and description to Agent context", async () => {
    const artifactsDirectory = await setup();
    const createdResponse = await server!.inject({
      method: "POST",
      url: "/api/v1/agent/styles",
      payload: {
        name: "留白型界面",
        category: "ui",
        description: "信息密度低，依赖大块留白和清晰对齐。",
      },
    });
    const created = createdResponse.json<{ id: string; revision: number }>();

    const upload = await server!.inject({
      method: "POST",
      url: `/api/v1/styles/${created.id}/references?filename=reference.png&expectedRevision=1`,
      headers: { "content-type": "image/png" },
      payload: onePixelPng,
    });
    expect(upload.statusCode, upload.body).toBe(201);
    const style = upload.json<{
      revision: number;
      referenceImages: Array<{ id: string; originalFilename: string }>;
    }>();
    expect(style).toMatchObject({ revision: 2 });
    expect(style.referenceImages).toHaveLength(1);
    const reference = style.referenceImages[0];

    const content = await server!.inject({
      method: "GET",
      url: `/api/v1/styles/${created.id}/references/${reference.id}/content`,
    });
    expect(content.statusCode).toBe(200);
    expect(content.rawPayload).toEqual(onePixelPng);
    expect(
      await readFile(path.join(artifactsDirectory, "styles", created.id, `${reference.id}.png`)),
    ).toEqual(onePixelPng);

    const context = await server!.inject({
      method: "GET",
      url: `/api/v1/agent/styles/${created.id}/context`,
    });
    expect(context.statusCode, context.body).toBe(200);
    expect(context.json()).toEqual({
      referenceImages: [{
        url: `/api/v1/styles/${created.id}/references/${reference.id}/content`,
      }],
      description: "信息密度低，依赖大块留白和清晰对齐。",
    });
  });

  it("uses revision checks and permanently deletes the entry and its images", async () => {
    const artifactsDirectory = await setup();
    const created = (await server!.inject({
      method: "POST",
      url: "/api/v1/styles",
      payload: {
        name: "杂志感画面",
        category: "visual",
        description: "以大字号和不对称留白形成编辑感。",
      },
    })).json<{ id: string }>();
    const uploaded = (await server!.inject({
      method: "POST",
      url: `/api/v1/styles/${created.id}/references?filename=reference.png&expectedRevision=1`,
      headers: { "content-type": "image/png" },
      payload: onePixelPng,
    })).json<{ revision: number; referenceImages: Array<{ id: string }> }>();

    const staleDelete = await server!.inject({
      method: "DELETE",
      url: `/api/v1/styles/${created.id}`,
      payload: { expectedRevision: 1 },
    });
    expect(staleDelete.statusCode).toBe(409);
    expect(staleDelete.json()).toMatchObject({
      code: "STYLE_REVISION_CONFLICT",
      actualRevision: 2,
    });

    const deleted = await server!.inject({
      method: "DELETE",
      url: `/api/v1/styles/${created.id}`,
      payload: { expectedRevision: uploaded.revision },
    });
    expect(deleted.statusCode, deleted.body).toBe(204);
    await expect(
      readFile(path.join(
        artifactsDirectory,
        "styles",
        created.id,
        `${uploaded.referenceImages[0].id}.png`,
      )),
    ).rejects.toMatchObject({ code: "ENOENT" });

    const missing = await server!.inject({
      method: "GET",
      url: `/api/v1/styles/${created.id}`,
    });
    expect(missing.statusCode).toBe(404);
  });

  it("rejects empty descriptions and invalid reference files", async () => {
    await setup();
    const empty = await server!.inject({
      method: "POST",
      url: "/api/v1/styles",
      payload: { name: "空说明", category: "visual", description: "   " },
    });
    expect(empty.statusCode).toBe(400);
    expect(empty.json()).toMatchObject({ code: "INVALID_STYLE" });

    const created = (await server!.inject({
      method: "POST",
      url: "/api/v1/styles",
      payload: {
        name: "参考校验",
        category: "visual",
        description: "只接受真实图片。",
      },
    })).json<{ id: string }>();
    const invalid = await server!.inject({
      method: "POST",
      url: `/api/v1/styles/${created.id}/references?filename=broken.png&expectedRevision=1`,
      headers: { "content-type": "image/png" },
      payload: Buffer.from("not an image"),
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ code: "INVALID_STYLE_REFERENCE" });
  });
});
