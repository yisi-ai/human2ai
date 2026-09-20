import { describe, expect, it } from "vitest";
import {
  addArea, addCompositionImage, addDirectionLine, addFocus, createDraft,
  compositionLayerOrder, draftFingerprint, removeItem, reorderCompositionLayers,
  renderCompositionReferenceSvg, renderCompositionSvg, validateDraft,
} from "../../src/domain/composition/index.ts";
import {
  cloneUiSketchDraft, createUiSketchDraft, groupUiSketchItems, reorderUiSketchLayers,
  uiSketchDraftForStage, uiSketchDraftFingerprint, uiSketchLayerOrder,
  updateUiSketchStageDraft, validateUiSketchDraft,
} from "../../src/domain/ui-sketch/index.ts";
import { renderUiSketchSvg } from "../../design-system/surfaces/human2ai-web/src/local/uiSketchExport.ts";
import { registeredCapability } from "../helpers/domain-baseline.ts";

function compositionLayersFixture() {
  let draft = addArea(createDraft(), { primitive: "circle", area: 0.1 }).draft;
  draft = addCompositionImage(draft).draft;
  draft.images[0]!.assetId = "test-image";
  draft = addDirectionLine(draft).draft;
  return addFocus(draft, { x: 0.5, y: 0.5 }).draft;
}

function uiLayersFixture() {
  return validateUiSketchDraft({
    ...createUiSketchDraft(),
    rectangles: [{ id: "region", x: 10, y: 10, width: 100, height: 100 }],
    images: [{ id: "image", x: 10, y: 10, width: 100, height: 100, assetId: "test-image" }],
    texts: [{ id: "text", x: 20, y: 20, text: "label", fontSize: 16 }],
  });
}

const consumers = ["image-composition", "ui-layout"];
it("covers every registered layer-order consumer", () => {
  expect(registeredCapability("capture.layer-order").consumers).toEqual(consumers);
});

describe("composition layers", () => {
  it("persists cross-type order without changing node arrays, metadata or geometry", () => {
    const draft = compositionLayersFixture();
    expect(compositionLayerOrder(draft)).toEqual(["image-1", "area-1", "direction-1", "focus-1"]);
    const next = reorderCompositionLayers(draft, ["image-1", "direction-1"], "bringToFront");
    expect(next.layerOrder).toEqual(["area-1", "focus-1", "image-1", "direction-1"]);
    expect(validateDraft(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect({ ...next, layerOrder: undefined }).toEqual({ ...draft, layerOrder: undefined });
    expect(draftFingerprint(next)).not.toBe(draftFingerprint(draft));
    expect(removeItem(next, "image-1").layerOrder).not.toContain("image-1");
    expect(reorderCompositionLayers(next, ["direction-1"], "bringToFront")).toBe(next);
    expect(() => validateDraft({ ...draft, layerOrder: ["image-1", "image-1"] })).toThrow();
  });

  it.each([renderCompositionSvg, renderCompositionReferenceSvg])("orders SVG content and keeps every focus mark together", (render) => {
    const draft = compositionLayersFixture();
    const source = () => "data:image/png;base64,example";
    const first = render(draft, source);
    const next = render(reorderCompositionLayers(draft, ["image-1"], "bringToFront"), source);
    expect(first.indexOf("<image")).toBeLessThan(first.lastIndexOf("<circle"));
    expect(next.indexOf("<image")).toBeGreaterThan(next.lastIndexOf("<circle"));
    expect(next.match(/<line /g)?.length).toBe(first.match(/<line /g)?.length);
  });
});

describe("UI layers", () => {
  it("shares group-aware ordering across stages and clones it independently", () => {
    const draft = groupUiSketchItems(uiLayersFixture(), ["image", "region"], "group");
    expect(uiSketchLayerOrder(draft)).toEqual(["image", "region", "text"]);
    const next = reorderUiSketchLayers(draft, ["region"], "bringToFront");
    expect(next.layerOrder).toEqual(["text", "image", "region"]);
    const staged = updateUiSketchStageDraft(draft, "end", next);
    expect(staged.layerOrder).toEqual(next.layerOrder);
    expect(uiSketchDraftForStage(staged, "start").layerOrder).toEqual(next.layerOrder);
    expect(uiSketchDraftForStage(staged, "end").layerOrder).toEqual(next.layerOrder);
    expect(validateUiSketchDraft(JSON.parse(JSON.stringify(staged)))).toEqual(staged);
    const clone = cloneUiSketchDraft(next);
    clone.layerOrder!.reverse();
    expect(next.layerOrder).toEqual(["text", "image", "region"]);
    expect(next.groups).toEqual(draft.groups);
    expect(next.rectangles).toEqual(draft.rectangles);
    expect(uiSketchDraftFingerprint(next)).not.toBe(uiSketchDraftFingerprint(draft));
    expect(() => validateUiSketchDraft({ ...draft, layerOrder: [1] })).toThrow();
  });

  it("exports cross-type stacking and excludes invisible content without disturbing order", () => {
    const draft = uiLayersFixture();
    const source = () => "data:image/png;base64,example";
    const first = renderUiSketchSvg(draft, source);
    const next = reorderUiSketchLayers(draft, ["image"], "bringToFront");
    const svg = renderUiSketchSvg(next, source);
    expect(first.indexOf("<image")).toBeLessThan(first.indexOf("<text"));
    expect(svg.indexOf("<image")).toBeGreaterThan(svg.indexOf("<text"));
    next.images[0]!.visible = false;
    expect(renderUiSketchSvg(next, source)).not.toContain("<image");
  });
});
