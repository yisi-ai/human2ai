import { addCompositionImage, validateDraft } from "./draft.ts";
import { COMPOSITION_CANVAS } from "./frame.ts";
import type { CompositionDraft, CompositionImage } from "./types.ts";

export function addCameraReference(input: CompositionDraft, source: {
  sessionId: string; cameraId: string; revision: number; assetId: string; width: number; height: number;
}): { draft: CompositionDraft; id: string } {
  const width = 320 * Math.min(1, source.width / source.height);
  const added = addCompositionImage(input, { width: width / COMPOSITION_CANVAS.width, height: (width * source.height / source.width) / COMPOSITION_CANVAS.height });
  const image = added.draft.images.find(i => i.id === added.id)!;
  image.assetId = source.assetId;
  image.cameraReference = { sessionId: source.sessionId, cameraId: source.cameraId, renderedRevision: source.revision };
  return { ...added, draft: validateDraft(added.draft) };
}

export function refreshCameraReference(input: CompositionDraft, source: {
  sessionId: string; cameraId: string; revision: number; assetId: string; width: number; height: number;
}): CompositionDraft {
  return validateDraft({ ...input, images: input.images.map(image => {
    const reference = image.cameraReference;
    if (!reference || reference.sessionId !== source.sessionId || reference.cameraId !== source.cameraId) return image;
    return { ...image, assetId: source.assetId,
      // An explicit output aspect change should show the complete camera frame.
      // Keep its centre and authored width; ordinary pose edits keep both sizes.
      height: image.width * COMPOSITION_CANVAS.width * source.height / source.width / COMPOSITION_CANVAS.height,
      cameraReference: { ...reference, renderedRevision: source.revision },
    };
  }) });
}

export function snapshotCameraReference(input: CompositionDraft, id: string): { draft: CompositionDraft; id: string } {
  const source = input.images.find(image => image.id === id);
  if (!source?.cameraReference || !source.assetId) throw new Error("COMPOSITION_CAMERA_REFERENCE_REQUIRED");
  const added = addCompositionImage(input);
  const { cameraReference: _reference, ...snapshot } = source;
  const image: CompositionImage = { ...snapshot, id: added.id, x: source.x + 24 / COMPOSITION_CANVAS.width, y: source.y + 24 / COMPOSITION_CANVAS.height };
  added.draft.images[added.draft.images.findIndex(i => i.id === added.id)] = image;
  return { ...added, draft: validateDraft(added.draft) };
}
