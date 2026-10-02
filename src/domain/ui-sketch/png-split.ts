import { compactGeometry } from "./png-canvas.ts";
import { groupUiSketchItems } from "./groups.ts";
import { uiSketchLayerOrder } from "./layers.ts";
import type { UiSketchDraft, UiSketchImage } from "./types.ts";
import type { PngSplitRegion } from "./png-split-regions.ts";

export interface PngSplitOptions {
  alphaThreshold: number;
  minSize: number;
  gap: number;
}

export interface PngSplitSource {
  nodeId: string;
  assetId: string;
  regions?: PngSplitRegion[];
}

export interface PngSplitPreview {
  sources: { nodeId: string; width: number; height: number; discarded: number; rects: [number, number, number, number][] }[];
}

export interface PngSplitPiece {
  nodeId: string;
  assetId: string | null;
  sourceNodeId: string;
  sourceRect: [number, number, number, number];
  sha256: string;
  width: number;
  height: number;
}

export interface PngSplitBatch {
  id: string;
  algorithm: string;
  packingAlgorithm: string;
  options: PngSplitOptions;
  sources: (PngSplitSource & { sha256: string; width: number; height: number; discarded: number })[];
  pieces: PngSplitPiece[];
  groupId: string | null;
}

export function pngSplitSourceApplied(draft: UiSketchDraft, source: PngSplitSource, options: PngSplitOptions): boolean {
  return Boolean(draft.pngSplits?.some(batch =>
    batch.options.alphaThreshold === options.alphaThreshold && batch.options.minSize === options.minSize &&
    batch.sources.some(item => item.nodeId === source.nodeId && item.assetId === source.assetId
      && JSON.stringify(item.regions ?? []) === JSON.stringify(source.regions ?? [])),
  ));
}

// Apply to the latest full draft, preserving identities and all edits made while assets were prepared.
// Provenance deliberately survives node deletion and ungrouping. Undo removes it with the operation.
export function appendPngSplit(
  draft: UiSketchDraft,
  batch: PngSplitBatch,
  origin: { x: number; y: number },
): UiSketchDraft {
  const sources = batch.sources.filter(source => !pngSplitSourceApplied(draft, source, batch.options));
  if (!sources.length) return draft;
  const sourceIds = new Set(sources.map(source => source.nodeId));
  const pieces = batch.pieces.filter(piece => sourceIds.has(piece.sourceNodeId));
  const knownIds = new Set([...draft.rectangles, ...draft.texts, ...draft.images, ...draft.groups].map(node => node.id));
  const packing = compactGeometry(pieces, origin.x, origin.y, batch.options.gap);
  const images: UiSketchImage[] = pieces.map((piece, index) => {
    if (!piece.assetId || knownIds.has(piece.nodeId)) throw new Error("Invalid PNG slice asset or node identity.");
    knownIds.add(piece.nodeId);
    return { id: piece.nodeId, assetId: piece.assetId, ...packing.geometry[index], crop: null,
      note: "", annotation: "", semanticType: "", origin: "import", visible: true, weight: "auto" };
  });
  const groupId = images.length >= 2 ? batch.groupId : null;
  if (images.length >= 2 && !groupId) throw new Error("Missing PNG slice group identity.");
  const next: UiSketchDraft = {
    ...draft,
    images: [...draft.images, ...images],
    layerOrder: [...uiSketchLayerOrder(draft), ...images.map(image => image.id)],
    stages: draft.stages.map(stage => ({ ...stage, images: [...stage.images,
      ...images.map(({ id, x, y, width, height, visible }) => ({ id, x, y, width, height, visible }))] })),
    pngSplits: [...(draft.pngSplits ?? []), { ...batch, sources, pieces, groupId }],
  };
  return groupId ? groupUiSketchItems(next, images.map(image => image.id), groupId) : next;
}
