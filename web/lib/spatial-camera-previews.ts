import type { SpatialCamera, SpatialDraft } from "../../src/domain/spatial/types";
import { spatialEntityRenderKey } from "../../src/domain/spatial/render-inputs";

export interface SpatialCameraPreviewState {
  scene: string;
  cameras: Map<string, { key: string; revision: number }>;
}

// Output cameras and observation-box helpers are absent from rendered scene geometry.
const sceneKey = (draft: SpatialDraft) => JSON.stringify([draft.version, draft.kind, draft.lightingEnabled ?? false, draft.characters.map(spatialEntityRenderKey), draft.objects.map(spatialEntityRenderKey)]);
const cameraKey = (camera: SpatialCamera) => JSON.stringify([camera.position, camera.target, camera.projection, camera.fov, camera.span, camera.width, camera.height, camera.background]);

/** Retain each camera's immutable URL until its actual rendering inputs change. */
export function updateSpatialCameraPreviews(previous: SpatialCameraPreviewState | undefined, draft: SpatialDraft, revision: number): SpatialCameraPreviewState {
  const scene = sceneKey(draft);
  return { scene, cameras: new Map(draft.cameras.map(camera => {
    const key = cameraKey(camera);
    const saved = previous?.scene === scene ? previous.cameras.get(camera.id) : undefined;
    return [camera.id, saved?.key === key ? saved : { key, revision }];
  })) };
}

/** Pending changes only suppress previews that no longer match the current draft. */
export function availableSpatialCameraPreviews(saved: SpatialCameraPreviewState | undefined, draft: SpatialDraft): Map<string, number> {
  const result = new Map<string, number>();
  if (saved?.scene !== sceneKey(draft)) return result;
  for (const camera of draft.cameras) {
    const preview = saved.cameras.get(camera.id);
    if (preview?.key === cameraKey(camera)) result.set(camera.id, preview.revision);
  }
  return result;
}
