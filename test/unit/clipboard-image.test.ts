import { describe, expect, it } from "vitest";

import { getClipboardImage, fitPastedImage } from "../../design-system/surfaces/human2ai-web/src/local/clipboardImage.js";

describe("canvas clipboard images", () => {
  it("selects one image file even when the clipboard also contains text", () => {
    const image = new File(["image"], "screenshot.png", { type: "image/png" });
    const other = new File(["text"], "note.txt", { type: "text/plain" });
    expect(getClipboardImage({ items: [
      { kind: "string", type: "text/plain", getAsFile: () => null },
      { kind: "file", type: image.type, getAsFile: () => image },
    ], files: [other, image] })).toBe(image);
  });

  it("falls back to files and leaves text-only clipboard contents alone", () => {
    const image = new File(["image"], "screenshot.webp", { type: "image/webp" });
    expect(getClipboardImage({ items: [], files: [image] })).toBe(image);
    expect(getClipboardImage({ items: [], files: [] })).toBeNull();
    expect(getClipboardImage({ items: [
      { kind: "file", type: "image/png", getAsFile: () => null },
    ], files: [new File(["text"], "note.txt", { type: "text/plain" })] })).toBeNull();
  });

  it("preserves landscape and portrait proportions without enlarging small images", () => {
    expect(fitPastedImage(1600, 900)).toEqual({ width: 320, height: 180 });
    expect(fitPastedImage(900, 1600)).toEqual({ width: 180, height: 320 });
    expect(fitPastedImage(80, 40)).toEqual({ width: 80, height: 40 });
  });
});
