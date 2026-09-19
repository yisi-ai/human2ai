import { expect, it, vi } from "vitest";
import { createHumanoid, createSpatialCameraBox, createSpatialDraft } from "../../src/domain/spatial/index.ts";
import { SpatialSceneCache } from "../../src/domain/spatial/scene-cache.ts";
import { createSpatialScene, disposeSpatialScene } from "../../src/domain/spatial/scene.ts";
import { applySpatialContactShading, spatialSurfaces } from "../../src/domain/spatial/lighting.ts";

const contactDraft = () => ({ ...createSpatialDraft(), objects: [
  { id: "box", name: "Box", kind: "box" as const, position: [0,.0376,0] as [number,number,number], rotation: [0,0,0] as [number,number,number], size: [.1,.06,.1] as [number,number,number], color: "#ffffff" },
  { id: "floor", name: "Floor", kind: "plane" as const, position: [0,0,0] as [number,number,number], rotation: [0,0,0] as [number,number,number], size: [3,1,3] as [number,number,number], color: "#ffffff" },
] });

it("retains surfaces and shading across camera, box, lighting and normalized snapshot changes", () => {
  const cache = new SpatialSceneCache(), draft = contactDraft();
  try {
    cache.update(draft);
    const meshes = spatialSurfaces(cache.scene), colors = meshes.map(mesh => mesh.geometry.getAttribute("color"));
    const next = structuredClone(draft);
    next.cameras[0].position = [5,3,1]; next.lightingEnabled = true;
    const rotated = { ...next, cameraBoxes: [{ ...createSpatialCameraBox("box-camera", "Box camera"), rotation: [20,40,0] as [number,number,number] }] };
    cache.update(rotated);
    expect(spatialSurfaces(cache.scene)).toEqual(meshes);
    meshes.forEach((mesh,i) => expect(mesh.geometry.getAttribute("color")).toBe(colors[i]));
  } finally { cache.dispose(); }
});

it("replaces only the edited object but refreshes its neighbors' contact shading after a drag", () => {
  const cache = new SpatialSceneCache(), draft = contactDraft();
  try {
    cache.update(draft);
    const [box,floor] = spatialSurfaces(cache.scene), originalColors = box.geometry.getAttribute("color").array.slice();
    const disposed = vi.fn(); floor.geometry.addEventListener("dispose", disposed);
    const moved = structuredClone(draft); moved.objects[1].position = [0,-1,0];
    cache.update(moved, { dragging: true });
    expect(spatialSurfaces(cache.scene)[0]).toBe(box);
    expect(spatialSurfaces(cache.scene)[1]).not.toBe(floor);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(box.geometry.getAttribute("color").array).toEqual(originalColors);
    cache.update(moved);
    expect([...box.geometry.getAttribute("color").array].every(value => value === 1)).toBe(true);
    const fresh = createSpatialScene(moved);
    try {
      applySpatialContactShading(fresh,moved);
      expect(spatialSurfaces(cache.scene).map(mesh => mesh.geometry.getAttribute("color").array))
        .toEqual(spatialSurfaces(fresh).map(mesh => mesh.geometry.getAttribute("color").array));
    } finally { disposeSpatialScene(fresh); }
    cache.update(draft);
    expect(box.geometry.getAttribute("color").array).toEqual(originalColors);
  } finally { cache.dispose(); }
});

it("keeps other characters intact and matches fresh posed geometry when one character changes", () => {
  const cache = new SpatialSceneCache(), draft = createSpatialDraft();
  draft.characters = [createHumanoid("a","A"),createHumanoid("b","B")];
  try {
    cache.update(draft, { showRig: true });
    const retained = spatialSurfaces(cache.scene).filter(mesh => mesh.userData.characterId === "b");
    const changed = structuredClone(draft); changed.characters[0].bones.find(b => b.id === "left-wrist")!.rotation = [-45,0,0];
    cache.update(changed, { showRig: true, dragging: true });
    expect(spatialSurfaces(cache.scene).filter(mesh => mesh.userData.characterId === "b")).toEqual(retained);
    const fresh = createSpatialScene(changed, { showRig: true });
    try {
      expect(spatialSurfaces(cache.scene).map(mesh => mesh.geometry.getAttribute("position").array))
        .toEqual(spatialSurfaces(fresh).map(mesh => mesh.geometry.getAttribute("position").array));
    } finally { disposeSpatialScene(fresh); }
    const removed = vi.fn(); retained[0].geometry.addEventListener("dispose",removed);
    cache.update({ ...changed, characters: [changed.characters[0]] });
    expect(removed).toHaveBeenCalledTimes(1);
    expect(spatialSurfaces(cache.scene).every(mesh => mesh.userData.characterId === "a")).toBe(true);
  } finally { cache.dispose(); }
});
