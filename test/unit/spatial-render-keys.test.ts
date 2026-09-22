import { expect, it, vi } from "vitest";
import { SpatialCameraRenderKeys } from "../../src/domain/spatial/camera-render-key.ts";
import { createSpatialCameraBox, createSpatialDraft } from "../../src/domain/spatial/index.ts";
import { cameraBoxView } from "../../src/domain/spatial/camera-box.ts";
import { renderSpatialPng } from "../../src/server/spatial-render.ts";
import { availableSpatialCameraPreviews, updateSpatialCameraPreviews } from "../../web/lib/spatial-camera-previews.ts";
import * as scenes from "../../src/domain/spatial/scene.ts";
import { spatialEntityRenderKey } from "../../src/domain/spatial/render-inputs.ts";
import { canonicalJson } from "../../src/domain/fingerprint.ts";

const fixture = () => {
  const draft = createSpatialDraft();
  Object.assign(draft.cameras[0], { position: [0,0,5], target: [0,0,0], projection: "orthographic", span: 2, width: 128, height: 128 });
  draft.objects = [
    { id: "visible", name: "Visible", kind: "box", position: [0,0,0], rotation: [0,0,0], size: [1,1,1], color: "#abcdef" },
    { id: "outside", name: "Outside", kind: "box", position: [10,0,0], rotation: [0,0,0], size: [.1,.1,.1], color: "#ff0000" },
  ];
  return draft;
};

it("reuses identical pixels across off-camera edits and refreshes on entry and exit", async () => {
  const keys = new SpatialCameraRenderKeys(), draft = fixture(), changed = structuredClone(draft);
  changed.objects[1].position = [20,1,0];
  const key = keys.key(draft, draft.cameras[0]);
  expect(keys.key(changed, changed.cameras[0])).toBe(key);
  expect(await renderSpatialPng(changed, changed.cameras[0])).toEqual(await renderSpatialPng(draft, draft.cameras[0]));
  const saved = updateSpatialCameraPreviews(undefined, draft, 1);
  expect(availableSpatialCameraPreviews(saved, changed).get("camera-1")).toBe(1);
  expect(availableSpatialCameraPreviews(updateSpatialCameraPreviews(saved, changed, 2), changed).get("camera-1")).toBe(1);
  changed.objects[1].position = [0,0,1];
  expect(keys.key(changed, changed.cameras[0])).not.toBe(key);
  const entered = updateSpatialCameraPreviews(saved, changed, 3);
  expect(availableSpatialCameraPreviews(entered, draft).size).toBe(0);
  expect(availableSpatialCameraPreviews(saved, changed).size).toBe(0);
});

it("includes offscreen contact neighbors and all casters with fitted shadows", () => {
  const keys = new SpatialCameraRenderKeys(), draft = fixture();
  draft.objects[0].size = [2,2,.1];
  draft.objects[1].size = [.02,.02,.02];
  draft.objects[1].position = [1.025,0,0];
  const changed = structuredClone(draft); changed.objects.pop();
  expect(keys.key(changed, changed.cameras[0])).not.toBe(keys.key(draft, draft.cameras[0]));
  expect(keys.key(changed, changed.cameras[0], "depth")).toBe(keys.key(draft, draft.cameras[0], "depth"));
  draft.lightingEnabled = true; changed.lightingEnabled = true;
  draft.objects[1].position = [100,0,0];
  expect(keys.key(changed, changed.cameras[0])).not.toBe(keys.key(draft, draft.cameras[0]));
});

it("tracks each camera and render pass independently", () => {
  const draft = fixture();
  draft.cameras.push({ ...draft.cameras[0], id: "other", position: [10,0,5], target: [10,0,0] });
  const saved = updateSpatialCameraPreviews(undefined, draft, 1), changed = structuredClone(draft);
  changed.objects[1].color = "#00ff00";
  expect([...availableSpatialCameraPreviews(saved, changed)]).toEqual([["camera-1", 1]]);
  expect(availableSpatialCameraPreviews(saved, changed, "skeleton").size).toBe(2);
  expect(availableSpatialCameraPreviews(saved, { ...draft, lightingEnabled: true }, "depth").size).toBe(2);
});

it("invalidates a box face when its up axis rotates around an unchanged viewing direction", () => {
  const draft = fixture(), keys = new SpatialCameraRenderKeys(), box = createSpatialCameraBox("box", "Box");
  const before = cameraBoxView(box, "front"), after = cameraBoxView({ ...box, rotation: [0,0,90] }, "front");
  expect(after.source.position).toEqual(before.source.position);
  expect(after.source.target).toEqual(before.source.target);
  expect(keys.key(draft, before.source, "color", before.camera)).not.toBe(keys.key(draft, after.source, "color", after.camera));
});

it("shares bounds across cameras and passes without rebuilding geometry for transforms or color", () => {
  const keys = new SpatialCameraRenderKeys(), draft = fixture(), create = vi.spyOn(scenes, "createSpatialScene");
  try {
    const first = keys.key(draft, draft.cameras[0]);
    const generated = create.mock.calls.length;
    expect(generated).toBe(2);
    keys.key(draft, draft.cameras[0], "depth");
    keys.key(draft, { ...draft.cameras[0], position: [10,0,5] });
    draft.objects[0].color = "#123456"; draft.objects[0].position = [.1,0,0]; draft.objects[0].rotation = [10,20,30];
    expect(keys.key(draft, draft.cameras[0])).not.toBe(first);
    expect(create).toHaveBeenCalledTimes(generated);
    draft.objects[0].size[0] = 2;
    keys.key(draft, draft.cameras[0]);
    expect(create).toHaveBeenCalledTimes(generated + 1);
  } finally { create.mockRestore(); }
});

it("cached entity keys detect nested in-place edits and retain canonical field ordering", () => {
  const entity = fixture().objects[0], first = spatialEntityRenderKey(entity);
  expect(spatialEntityRenderKey(entity)).toBe(first);
  entity.note = "Metadata only"; entity.name = "Renamed";
  expect(spatialEntityRenderKey(entity)).toBe(first);
  entity.position[0] += 1;
  const changed = spatialEntityRenderKey(entity);
  expect(changed).not.toBe(first);
  expect(spatialEntityRenderKey(JSON.parse(canonicalJson(entity)))).toBe(changed);
});
