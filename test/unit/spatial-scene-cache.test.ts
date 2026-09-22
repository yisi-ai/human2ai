import { expect, it, vi } from "vitest";
import { createHumanoid, createSpatialCameraBox, createSpatialDraft } from "../../src/domain/spatial/index.ts";
import { SpatialSceneCache } from "../../src/domain/spatial/scene-cache.ts";
import { createSpatialScene, disposeSpatialScene } from "../../src/domain/spatial/scene.ts";
import { applySpatialContactShading, spatialSurfaces } from "../../src/domain/spatial/lighting.ts";
import { canonicalJson } from "../../src/domain/fingerprint.ts";
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";

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

it("reuses moved geometry but refreshes its neighbors' contact shading after a drag", () => {
  const cache = new SpatialSceneCache(), draft = contactDraft();
  try {
    cache.update(draft);
    const [box,floor] = spatialSurfaces(cache.scene), originalColors = box.geometry.getAttribute("color").array.slice();
    const disposed = vi.fn(); floor.geometry.addEventListener("dispose", disposed);
    const moved = structuredClone(draft); moved.objects[1].position = [0,-1,0];
    cache.update(moved, { dragging: true });
    expect(spatialSurfaces(cache.scene)[0]).toBe(box);
    expect(spatialSurfaces(cache.scene)[1]).toBe(floor);
    expect(disposed).not.toHaveBeenCalled();
    expect(floor.getWorldPosition(new Vector3()).y).toBe(-1);
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

it("retains transformed character buffers and matches freshly generated world geometry", () => {
  const draft = createSpatialDraft(); draft.characters = [createHumanoid("a", "A")];
  const cache = new SpatialSceneCache();
  try {
    cache.update(draft, { dragging: true });
    const meshes = spatialSurfaces(cache.scene), attributes = meshes.map(mesh => mesh.geometry.getAttribute("position"));
    const changed = structuredClone(draft);
    changed.characters[0].position = [2,3,4]; changed.characters[0].rotation = [10,20,30];
    cache.update(changed, { dragging: true });
    const fresh = createSpatialScene(changed);
    try {
      spatialSurfaces(fresh).forEach((mesh, i) => {
        expect(spatialSurfaces(cache.scene)[i]).toBe(meshes[i]);
        expect(meshes[i].geometry.getAttribute("position")).toBe(attributes[i]);
        const positions = mesh.geometry.getAttribute("position");
        for (let j = 0; j < positions.count; j++) {
          const actual = new Vector3().fromBufferAttribute(attributes[i], j).applyMatrix4(meshes[i].matrixWorld);
          const expected = new Vector3().fromBufferAttribute(positions, j).applyMatrix4(mesh.matrixWorld);
          expect(actual.distanceTo(expected)).toBeLessThan(.000002);
        }
      });
    } finally { disposeSpatialScene(fresh); }
  } finally { cache.dispose(); }
});

it("keeps only the latest pending shading and ignores results during a newer gesture or after disposal", async () => {
  const pending: Array<(colors: Float32Array[]) => void> = [];
  const shade = vi.fn(() => new Promise<Float32Array[]>(resolve => pending.push(resolve)));
  const onShaded = vi.fn(), cache = new SpatialSceneCache({ shade, onShaded }), draft = contactDraft();
  cache.update(draft);
  const original = spatialSurfaces(cache.scene).map(mesh => mesh.geometry.getAttribute("color"));
  const moved = structuredClone(draft); moved.objects[1].position[1] = -1;
  cache.update(moved, { dragging: true });
  expect(spatialSurfaces(cache.scene).map(mesh => mesh.geometry.getAttribute("color"))).toEqual(original);
  const finish = async (source: typeof draft) => {
    const scene = createSpatialScene(source);
    try { pending.shift()!(applySpatialContactShading(scene, source)); }
    finally { disposeSpatialScene(scene); }
    await new Promise(resolve => setImmediate(resolve));
  };
  await finish(draft);
  expect(onShaded).not.toHaveBeenCalled();
  cache.update(moved);
  cache.update(draft); cache.update(moved); cache.update(draft);
  expect(shade).toHaveBeenCalledTimes(2);
  await finish(moved);
  expect(shade).toHaveBeenCalledTimes(3);
  expect(onShaded).not.toHaveBeenCalled();
  await finish(draft);
  expect(onShaded).toHaveBeenCalledTimes(1);
  cache.update(moved); cache.dispose();
  await finish(moved);
  expect(onShaded).toHaveBeenCalledTimes(1);
});

it("retains the actual meshes and contact colors while editing names and notes", () => {
  const cache = new SpatialSceneCache(), draft = { ...contactDraft(), characters: [createHumanoid("person", "Person")] };
  try {
    cache.update(draft);
    const meshes = spatialSurfaces(cache.scene), colors = meshes.map(mesh => mesh.geometry.getAttribute("color"));
    const changed = structuredClone(draft);
    for (const entity of [...changed.characters, ...changed.objects]) Object.assign(entity, { name: "Renamed", note: "Preserve the pose\nAdd detail" });
    expect(cache.update(JSON.parse(canonicalJson(changed)))).toBe(false);
    spatialSurfaces(cache.scene).forEach((mesh, i) => { expect(mesh).toBe(meshes[i]); expect(mesh.geometry.getAttribute("color")).toBe(colors[i]); });
  } finally { cache.dispose(); }
});

it("keeps other characters intact and matches fresh posed geometry when one character changes", () => {
  const cache = new SpatialSceneCache(), draft = createSpatialDraft();
  draft.characters = [createHumanoid("a","A"),createHumanoid("b","B")];
  try {
    cache.update(draft, { showRig: true });
    const retained = spatialSurfaces(cache.scene).filter(mesh => mesh.userData.characterId === "b");
    const helpers: Mesh[] = [];
    cache.scene.traverse(object => { if (object instanceof Mesh && object.userData.rig && object.userData.characterId === "a") helpers.push(object); });
    const helperGeometry = helpers.map(mesh => mesh.geometry);
    const changed = structuredClone(draft);
    changed.characters[0].position = [2,1,3]; changed.characters[0].rotation = [10,30,-20];
    cache.update(changed, { showRig: true, dragging: true });
    changed.characters[0].bones.find(b => b.id === "left-wrist")!.rotation = [-45,0,0];
    cache.update(changed, { showRig: true, dragging: true });
    expect(spatialSurfaces(cache.scene).filter(mesh => mesh.userData.characterId === "b")).toEqual(retained);
    const fresh = createSpatialScene(changed, { showRig: true });
    try {
      const freshHelpers: Mesh[] = [];
      fresh.traverse(object => { if (object instanceof Mesh && object.userData.rig && object.userData.characterId === "a") freshHelpers.push(object); });
      helpers.forEach((mesh, i) => {
        expect(mesh.parent).not.toBeNull();
        expect(mesh.geometry).toBe(helperGeometry[i]);
        expect(mesh).toBeInstanceOf(InstancedMesh);
        const batch = mesh as InstancedMesh, expected = freshHelpers.filter(other => other.userData.rig === mesh.userData.rig);
        expect(batch.count).toBe(expected.length);
        for (let j = 0; j < batch.count; j++) {
          const actual = new Matrix4(); batch.getMatrixAt(j, actual); actual.premultiply(batch.matrixWorld);
          expect(batch.userData.instances[j]).toEqual(expected[j].userData);
          actual.elements.forEach((value,k) => expect(Math.abs(value-expected[j].matrixWorld.elements[k])).toBeLessThan(.000001));
        }
      });
      expect(spatialSurfaces(cache.scene).map(mesh => mesh.geometry.getAttribute("position").array))
        .toEqual(spatialSurfaces(fresh).map(mesh => mesh.geometry.getAttribute("position").array));
    } finally { disposeSpatialScene(fresh); }
    const removed = vi.fn(); retained[0].geometry.addEventListener("dispose",removed);
    cache.update({ ...changed, characters: [changed.characters[0]] });
    expect(removed).toHaveBeenCalledTimes(1);
    expect(spatialSurfaces(cache.scene).every(mesh => mesh.userData.characterId === "a")).toBe(true);
  } finally { cache.dispose(); }
});

it("batches helper draws while keeping per-joint picking after movement and releasing instance buffers", () => {
  const draft = createSpatialDraft(); draft.characters = [createHumanoid("a", "A")];
  const cache = new SpatialSceneCache({ shade: () => new Promise(() => {}) });
  try {
    cache.update(draft, { showRig: true });
    const batches: InstancedMesh[] = [];
    cache.scene.traverse(object => { if (object instanceof InstancedMesh) batches.push(object); });
    expect(batches).toHaveLength(2);
    const joints = batches.find(mesh => mesh.userData.rig === "joint")!, index = joints.userData.instances.findIndex((data: Record<string,string>) => data.jointId === "left-shoulder");
    draft.characters[0].position[0] += 2;
    cache.update(draft, { showRig: true, dragging: true });
    const matrix = new Matrix4(); joints.getMatrixAt(index, matrix); matrix.premultiply(joints.matrixWorld);
    const point = new Vector3().setFromMatrixPosition(matrix);
    const ray = new Raycaster(point.clone().add(new Vector3(0,0,2)), new Vector3(0,0,-1));
    const hit = ray.intersectObject(joints).find(hit => hit.instanceId === index);
    expect(hit).toBeDefined(); expect(joints.userData.instances[hit!.instanceId!].jointId).toBe("left-shoulder");
    const disposed = vi.fn(); joints.addEventListener("dispose", disposed);
    cache.update(draft, { showRig: false });
    expect(disposed).toHaveBeenCalledTimes(1);
  } finally { cache.dispose(); }
});
