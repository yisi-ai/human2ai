import { previewSourceKey, type SessionPreviewReference } from "../session/preview.ts";
import { createHuman2AiCanvasNodeMetadata } from "../canvas-node-metadata.ts";
import { uiSketchLayerOrder } from "./layers.ts";
import type { UiSketchDraft } from "./types.ts";

export interface MaterializedSessionPreview {
  reference: SessionPreviewReference;
  assetId: string;
  width: number;
  height: number;
}

export function uiSessionPreviewSize(source: { width: number; height: number }, frame: { width: number; height: number }) {
  const scale = Math.min(1, frame.width * 0.5 / source.width, frame.height * 0.5 / source.height);
  return { width: source.width * scale, height: source.height * scale };
}

export function addUiSessionPreview(
  draft: UiSketchDraft,
  preview: MaterializedSessionPreview,
  id: string,
  center?: { x: number; y: number },
  size?: { width: number; height: number },
): UiSketchDraft {
  const { width, height } = size ?? uiSessionPreviewSize(preview, draft.frame);
  return { ...draft, images: [...draft.images, {
    ...createHuman2AiCanvasNodeMetadata(), id, x: (center?.x ?? draft.frame.x + draft.frame.width / 2) - width / 2,
    y: (center?.y ?? draft.frame.y + draft.frame.height / 2) - height / 2, width, height,
    visible: true, weight: "auto", crop: null, assetId: preview.assetId, previewReference: preview.reference,
  }], layerOrder: [...uiSketchLayerOrder(draft), id] };
}

function authoredContent(draft: UiSketchDraft) {
  return JSON.stringify({ ...draft, images: draft.images.map(image => {
    if (!image.previewReference) return image;
    const { renderedRevision: _revision, ...source } = image.previewReference;
    return { ...image, assetId: null, previewReference: source };
  }) });
}

/** Null means an actual external edit, which must retain normal conflict handling. */
export function mergeUiPreviewRefresh(local: UiSketchDraft, base: UiSketchDraft, remote: UiSketchDraft): UiSketchDraft | null {
  if (authoredContent(base) !== authoredContent(remote)) return null;
  const originals = new Map(base.images.map(image => [image.id, image]));
  const updates = new Map(remote.images.map(image => [image.id, image]));
  let changed = false;
  const images = local.images.map(image => {
    const before = originals.get(image.id), after = updates.get(image.id);
    if (!image.previewReference || !before?.previewReference || !after?.previewReference
      || previewSourceKey(image.previewReference) !== previewSourceKey(after.previewReference)
      || image.assetId !== before.assetId
      || image.assetId === after.assetId && image.previewReference.renderedRevision === after.previewReference.renderedRevision) return image;
    changed = true;
    return { ...image, assetId: after.assetId, previewReference: after.previewReference };
  });
  return changed ? { ...local, images } : local;
}
