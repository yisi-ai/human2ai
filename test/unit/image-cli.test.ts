import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { executeCli } from "../../src/cli/main.js";

const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';

describe("session image CLI", () => {
  it("uploads SVG bytes and reads or exports the same source", async () => {
    const directory = await mkdtemp(join(tmpdir(), "human2ai-image-cli-"));
    try {
      const filename = join(directory, "图形.svg");
      await writeFile(filename, source);
      const fetcher = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ id: "asset-1", mimeType: "image/svg+xml" }, { status: 201 }))
        .mockResolvedValueOnce(new Response(source, { headers: { "content-type": "image/svg+xml" } }))
        .mockResolvedValueOnce(new Response(source, { headers: { "content-type": "image/svg+xml; charset=utf-8" } }));
      const dependencies = { fetch: fetcher, serviceUrl: "http://localhost:4190" };
      await expect(executeCli(["image", "upload", "--session", "session-1", "--input", filename], dependencies))
        .resolves.toMatchObject({ id: "asset-1" });
      expect(String(fetcher.mock.calls[0][0])).toBe("http://localhost:4190/api/v1/sessions/session-1/assets?filename=%E5%9B%BE%E5%BD%A2.svg");
      expect(fetcher.mock.calls[0][1]?.body).toEqual(Buffer.from(source));
      const args = ["image", "source", "--session", "session-1", "--asset", "asset-1"];
      await expect(executeCli(args, dependencies)).resolves.toEqual({ sessionId: "session-1", assetId: "asset-1", source });
      const output = join(directory, "export.svg");
      await executeCli([...args, "--output", output], dependencies);
      expect(await readFile(output, "utf8")).toBe(source);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports a missing image", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      code: "IMAGE_ASSET_NOT_FOUND", message: "Missing image",
    }, { status: 404 }));
    await expect(executeCli(["image", "source", "--session", "session-1", "--asset", "missing"], { fetch: fetcher }))
      .rejects.toMatchObject({ code: "IMAGE_ASSET_NOT_FOUND", status: 404 });
  });

  it("does not decode bitmap bytes as SVG source", async () => {
    await expect(executeCli(["image", "source", "--session", "session-1", "--asset", "bitmap"], {
      fetch: async () => new Response("bytes", { headers: { "content-type": "image/png" } }),
    })).rejects.toMatchObject({ code: "INVALID_IMAGE_ASSET" });
  });
});
