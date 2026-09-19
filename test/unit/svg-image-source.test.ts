import { describe, expect, it } from "vitest";

import { readImageFile } from "../../web/lib/human2ai-api.js";

describe("image source reading", () => {
  it("preserves complete SVG source for both copying and downloading", async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg"><title>叶片 &amp; 线条</title></svg>';
    const file = await readImageFile("/image", async () => new Response(source, {
      headers: { "content-type": "image/svg+xml; charset=utf-8" },
    }));
    expect(file.name).toBe("image.svg");
    expect(file.type).toBe("image/svg+xml");
    expect(await file.text()).toBe(source);
  });

  it.each([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]])(
    "preserves original %s bytes and assigns the matching extension", async (type, extension) => {
      const bytes = new Uint8Array([0, 128, 255, 12, 45]);
      const file = await readImageFile("/image", async () => new Response(bytes, {
        headers: { "content-type": type },
      }));
      expect(file.name).toBe(`image.${extension}`);
      expect(file.type).toBe(type);
      expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
    },
  );

  it("does not offer a successful HTML fallback response as an image", async () => {
    await expect(readImageFile("/image", async () => new Response("<html></html>", {
      headers: { "content-type": "text/html" },
    }))).rejects.toThrow("Unsupported image content type");
  });

  it("reports read errors so the source panel can retry", async () => {
    await expect(readImageFile("/image", async () => new Response(null, { status: 404 }))).rejects.toThrow("404");
  });
});
