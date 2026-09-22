import { SPATIAL_RENDER_PASSES, type SpatialDraft, type SpatialRenderPass } from "../../src/domain/spatial/types";
import { SpatialCameraRenderKeys } from "../../src/domain/spatial/camera-render-key";

export interface SpatialCameraPreviewState {
  cameras: Map<string, Record<SpatialRenderPass, { key: string; revision: number }>>;
}

const renderKeys = new SpatialCameraRenderKeys();

/** Retain each camera's immutable URL until its actual rendering inputs change. */
export function updateSpatialCameraPreviews(previous: SpatialCameraPreviewState | undefined, draft: SpatialDraft, revision: number): SpatialCameraPreviewState {
  return { cameras: new Map(draft.cameras.map(camera => [camera.id, Object.fromEntries(SPATIAL_RENDER_PASSES.map(pass => {
    const key = renderKeys.key(draft, camera, pass);
    const saved = previous?.cameras.get(camera.id)?.[pass];
    return [pass, saved?.key === key ? saved : { key, revision }];
  })) as Record<SpatialRenderPass, { key: string; revision: number }>])) };
}

/** Pending changes only suppress previews that no longer match the current draft. */
export function availableSpatialCameraPreviews(saved: SpatialCameraPreviewState | undefined, draft: SpatialDraft, pass: SpatialRenderPass = "color"): Map<string, number> {
  const result = new Map<string, number>();
  if (!saved) return result;
  for (const camera of draft.cameras) {
    const preview = saved.cameras.get(camera.id)?.[pass];
    if (preview?.key === renderKeys.key(draft, camera, pass)) result.set(camera.id, preview.revision);
  }
  return result;
}
