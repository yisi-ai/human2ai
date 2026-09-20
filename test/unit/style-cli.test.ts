import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { executeCli } from "../../src/cli/main.js";

describe("style CLI", () => {
  it("creates, filters and updates spatial styles", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.body
      ? Response.json(JSON.parse(String(init.body)))
      : Response.json({ styles: [{ id: "3d", category: "spatial" }, { id: "ui", category: "ui" }] })) as typeof fetch;
    await expect(executeCli(["style", "create", "--name", "Toy city", "--category", "spatial", "--description", "Matte low-poly forms."], { fetch: fetchMock })).resolves.toMatchObject({ category: "spatial" });
    await expect(executeCli(["style", "list", "--category", "spatial"], { fetch: fetchMock })).resolves.toEqual({ styles: [{ id: "3d", category: "spatial" }] });
    await expect(executeCli(["style", "update", "--style", "3d", "--expected-revision", "1", "--category", "spatial"], { fetch: fetchMock })).resolves.toMatchObject({ category: "spatial" });
    await expect(executeCli(["style", "list", "--category", "unsupported"], { fetch: fetchMock })).rejects.toThrow(/category/);
  });

  it("creates Agent styles without accepting a caller-supplied creator", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      id: "style-1",
      creatorType: "agent",
      revision: 1,
    }, { status: 201 })) as typeof fetch;

    await expect(executeCli([
      "style",
      "create",
      "--name",
      "Quiet UI",
      "--category",
      "ui",
      "--description",
      "Sparse controls with strong alignment.",
      "--summary",
      "Sparse controls, generous whitespace and precise alignment.",
    ], { fetch: fetchMock })).resolves.toMatchObject({ creatorType: "agent" });

    const [url, init] = vi.mocked(fetchMock).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:4180/api/v1/agent/styles");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Quiet UI",
      category: "ui",
      description: "Sparse controls with strong alignment.",
      promptSummary: "Sparse controls, generous whitespace and precise alignment.",
    });
    await expect(executeCli([
      "style",
      "create",
      "--name",
      "Invalid",
      "--category",
      "ui",
      "--description",
      "Text",
      "--creator",
      "user",
    ], { fetch: fetchMock })).rejects.toThrow(/does not accept --creator/);
  });

  it("returns only reference images and the overall description when getting a style", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      referenceImages: [
        { url: "/api/v1/styles/style-1/references/ref-1/content" },
      ],
      description: "Muted surfaces and deliberate whitespace.",
    })) as typeof fetch;

    await expect(executeCli([
      "style",
      "get",
      "--style",
      "style-1",
    ], { fetch: fetchMock })).resolves.toEqual({
      referenceImages: [
        { url: "http://127.0.0.1:4180/api/v1/styles/style-1/references/ref-1/content" },
      ],
      description: "Muted surfaces and deliberate whitespace.",
    });
  });

  it("uploads a local reference image and permanently deletes a style", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-style-cli-"));
    const imagePath = path.join(directory, "参考.png");
    await writeFile(imagePath, Buffer.from([1, 2, 3]));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "style-1", revision: 2 }, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })) as typeof fetch;

    try {
      await expect(executeCli([
        "style",
        "add-reference",
        "--style",
        "style-1",
        "--input",
        imagePath,
        "--expected-revision",
        "1",
      ], { fetch: fetchMock })).resolves.toMatchObject({ revision: 2 });
      expect(String(vi.mocked(fetchMock).mock.calls[0][0])).toContain(
        "/api/v1/styles/style-1/references?filename=%E5%8F%82%E8%80%83.png&expectedRevision=1",
      );
      expect(vi.mocked(fetchMock).mock.calls[0][1]).toMatchObject({
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
      });

      await expect(executeCli([
        "style",
        "delete",
        "--style",
        "style-1",
        "--expected-revision",
        "2",
      ], { fetch: fetchMock })).resolves.toEqual({ deleted: true, styleId: "style-1" });
      expect(vi.mocked(fetchMock).mock.calls[1][1]).toMatchObject({
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: 2 }),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
