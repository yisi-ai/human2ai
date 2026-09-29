import { describe, expect, it, vi } from "vitest";
import { readCanvasClipboard, writeCanvasClipboard, transferCanvasClipboardImages } from "../../design-system/surfaces/human2ai-web/src/local/canvasClipboard.ts";
import { addArea, copyCompositionItems, createDraft, pasteCompositionItems } from "../../src/domain/composition/index.ts";
import { parseCompositionClipboard } from "../../src/domain/composition/clipboard.ts";
import { copyUiSketchItems, createUiSketchDraft, pasteUiSketchItems } from "../../src/domain/ui-sketch/index.ts";
import { parseUiSketchClipboard } from "../../src/domain/ui-sketch/clipboard.ts";

function transfer() {
  const data = new Map<string, string>();
  return { getData: (type: string) => data.get(type) ?? "", setData: (type: string, value: string) => { data.set(type, value); } };
}

describe("cross-canvas node clipboard", () => {
  it("carries a composition snapshot to an independent canvas without source memory", () => {
    const source = addArea(createDraft(), { primitive: "triangle", x: 0.2, y: 0.3, area: 0.1 }).draft;
    const data = transfer();
    const token = writeCanvasClipboard(data, "composition", copyCompositionItems(source, [source.areas[0]!.id]));
    source.areas[0]!.x = 0.9;
    const received = readCanvasClipboard(data, "composition", parseCompositionClipboard)!;
    expect(received.token).toBe(token);
    const target = addArea(createDraft(), { primitive: "circle", area: 0.1 }).draft;
    const pasted = pasteCompositionItems(target, received.items, { x: 0.02, y: 0.03 });
    expect(pasted.ids).not.toContain(target.areas[0]!.id);
    expect(pasted.draft.areas.at(-1)).toMatchObject({ primitive: "triangle", x: 0.22 });
    expect(pasted.draft.areas.at(-1)!.y).toBeCloseTo(0.33);
    expect(target.areas).toHaveLength(1);
  });

  it("carries UI grouping, layer order and content while creating independent ids", () => {
    const source = createUiSketchDraft();
    source.rectangles = [1, 2].map(n => ({ id: `rectangle-${n}`, x: n * 30, y: 10, width: 20, height: 20, note: "note", annotation: "", semanticType: "", origin: "user", visible: true, weight: "medium" }));
    source.groups = [{ id: "group-1", itemIds: ["rectangle-1", "rectangle-2"] }];
    source.layerOrder = ["rectangle-2", "rectangle-1"];
    const data = transfer();
    writeCanvasClipboard(data, "ui", copyUiSketchItems(source, ["rectangle-1"]));
    const received = readCanvasClipboard(data, "ui", parseUiSketchClipboard)!;
    const target = createUiSketchDraft();
    const pasted = pasteUiSketchItems(target, received.items, { x: 24, y: 24 });
    expect(pasted.draft.rectangles.map(n => n.x)).toEqual([54, 84]);
    expect(pasted.draft.rectangles.every(n => n.note === "note")).toBe(true);
    expect(pasted.draft.groups[0]!.itemIds).toEqual(pasted.draft.rectangles.map(n => n.id));
    expect(pasted.draft.layerOrder).toEqual([...pasted.draft.rectangles].reverse().map(n => n.id));
    expect(target.rectangles).toHaveLength(0);
  });

  it("rejects foreign types, unsupported versions, invalid data and old tokens", () => {
    const data = transfer();
    writeCanvasClipboard(data, "composition", []);
    expect(readCanvasClipboard(data, "ui", parseUiSketchClipboard)).toBeNull();
    for (const value of ["old-token", "{", JSON.stringify({ version: 2, token: "x", sources: {}, items: [] }), JSON.stringify({ version: 1, token: "x", sources: {}, items: [{ kind: "area", item: { id: "bad" } }] })]) {
      data.setData("composition", value);
      expect(readCanvasClipboard(data, "composition", parseCompositionClipboard)).toBeNull();
    }
    expect(parseUiSketchClipboard({ rectangles: [{ id: "bad" }], texts: [], images: [], groups: [], layerOrder: [] })).toBeNull();
  });

  it("gives repeated copies of the same nodes different identities for paste offsets", () => {
    const data = transfer();
    const first = writeCanvasClipboard(data, "ui", {});
    expect(writeCanvasClipboard(data, "ui", {})).not.toBe(first);
  });

  it("transfers shared image assets once while retaining crop and node metadata", async () => {
    const images = [1, 2].map(id => ({ id, assetId: "source", crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } }));
    const data = transfer();
    const url = "http://localhost/api/v1/sessions/source/assets/source/content";
    writeCanvasClipboard(data, "images", images, images, () => url);
    expect(JSON.parse(data.getData("images")).sources).toEqual({ source: url });
    const read = vi.fn(async () => new File(["image"], "image.png"));
    const upload = vi.fn(async () => "destination");
    expect(await transferCanvasClipboardImages(images, { source: url }, { origin: "http://localhost", read, upload, isCurrent: () => true })).toBe(true);
    expect(read).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledOnce();
    expect(images.map(image => image.assetId)).toEqual(["destination", "destination"]);
    expect(images[0]!.crop.width).toBe(0.5);
  });

  it("does not re-upload same-session images or continue a cancelled transfer", async () => {
    const url = "http://localhost/api/v1/sessions/source/assets/source/content";
    const upload = vi.fn(async () => "destination");
    const images = [{ assetId: "source" }];
    await transferCanvasClipboardImages(images, { source: url }, { origin: "http://localhost", resolveSource: () => url, upload, isCurrent: () => true });
    expect(upload).not.toHaveBeenCalled();
    let current = true;
    const read = async () => { current = false; return new File([], "image.png"); };
    expect(await transferCanvasClipboardImages(images, { source: url }, { origin: "http://localhost", read, upload, isCurrent: () => current })).toBe(false);
    expect(upload).not.toHaveBeenCalled();
    expect(images[0]!.assetId).toBe("source");
  });

  it("rejects failed or foreign image sources instead of committing broken nodes", async () => {
    const upload = vi.fn(async () => "destination");
    const read = vi.fn(async () => { throw new Error("not found"); });
    const options = { origin: "http://localhost", read, upload, isCurrent: () => true };
    for (const source of ["https://example.com/image.png", "http://localhost/api/v1/sessions/x", "http://localhost/api/v1/sessions/x/assets/y/content"]) {
      await expect(transferCanvasClipboardImages([{ assetId: "source" }], { source }, options)).rejects.toThrow();
    }
    expect(read).toHaveBeenCalledOnce();
    expect(upload).not.toHaveBeenCalled();
  });
});
