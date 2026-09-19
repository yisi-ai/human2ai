import { describe, expect, it } from "vitest";
import { createHumanoid, createSpatialCamera, createSpatialCameraBox, createSpatialDraft, type SpatialCamera, type SpatialDraft } from "../../src/domain/spatial/index.ts";
import { availableSpatialCameraPreviews, updateSpatialCameraPreviews } from "../../web/lib/spatial-camera-previews.ts";
import { canonicalJson } from "../../src/domain/fingerprint.ts";

const initial = (): SpatialDraft => ({ ...createSpatialDraft(), cameras: [createSpatialCamera("a", "A"), createSpatialCamera("b", "B")] });
const cameraEdit = (draft: SpatialDraft, id: string, patch: Partial<SpatialCamera>): SpatialDraft => ({ ...draft, cameras: draft.cameras.map(camera => camera.id === id ? { ...camera, ...patch } : camera) });

describe("saved spatial camera previews", () => {
  it.each<Partial<SpatialCamera>>([
    { position: [2, 3, 4] }, { target: [1, 2, 3] }, { projection: "orthographic" },
    { fov: 60 }, { span: 8 }, { width: 800 }, { height: 600 }, { background: "#abcdef" },
  ])("refreshes only the edited camera for %j", patch => {
    const draft = initial(), saved = updateSpatialCameraPreviews(undefined, draft, 3);
    const changed = cameraEdit(draft, "a", patch);
    expect([...availableSpatialCameraPreviews(saved, changed)]).toEqual([["b", 3]]);
    const next = updateSpatialCameraPreviews(saved, changed, 4);
    expect([...availableSpatialCameraPreviews(next, changed)]).toEqual([["a", 4], ["b", 3]]);
    expect([...availableSpatialCameraPreviews(saved, draft)]).toEqual([["a", 3], ["b", 3]]);
  });

  it.each<(draft: SpatialDraft) => SpatialDraft>([
    draft => ({ ...draft, lightingEnabled: true }),
    draft => ({ ...draft, characters: [createHumanoid("person", "Person")] }),
    draft => ({ ...draft, objects: [{ id: "object", name: "Box", kind: "box", position: [0, 0, 0], rotation: [0, 0, 0], size: [1, 1, 1], color: "#abcdef" }] }),
  ])("refreshes every camera when shared scene content changes", change => {
    const draft = initial(), saved = updateSpatialCameraPreviews(undefined, draft, 1), changed = change(draft);
    expect(availableSpatialCameraPreviews(saved, changed).size).toBe(0);
    expect([...availableSpatialCameraPreviews(updateSpatialCameraPreviews(saved, changed, 2), changed)]).toEqual([["a", 2], ["b", 2]]);
  });

  it("keeps previews through camera renaming, reordering and helper edits", () => {
    const draft = initial(), saved = updateSpatialCameraPreviews(undefined, draft, 1);
    const changed = { ...cameraEdit(draft, "a", { name: "Renamed" }), cameraBoxes: [createSpatialCameraBox("box", "Box")] };
    changed.cameras.reverse();
    expect([...availableSpatialCameraPreviews(updateSpatialCameraPreviews(saved, changed, 2), changed)]).toEqual([["b", 1], ["a", 1]]);
  });

  it("handles new and deleted cameras without invalidating their peers", () => {
    const draft = initial(), saved = updateSpatialCameraPreviews(undefined, draft, 1);
    const added = { ...draft, cameras: [...draft.cameras, createSpatialCamera("c", "C")] };
    expect([...availableSpatialCameraPreviews(saved, added)]).toEqual([["a", 1], ["b", 1]]);
    const savedAdded = updateSpatialCameraPreviews(saved, added, 2);
    const removed = { ...added, cameras: added.cameras.filter(camera => camera.id !== "a") };
    expect([...availableSpatialCameraPreviews(updateSpatialCameraPreviews(savedAdded, removed, 3), removed)]).toEqual([["b", 1], ["c", 2]]);
  });

  it("retains every preview when object names or notes change", () => {
    const draft = initial();
    draft.characters = [createHumanoid("person", "Person")];
    draft.objects = [{ id: "desk", name: "Desk", kind: "box", position: [0, 0, 0], rotation: [0, 0, 0], size: [1, 1, 1], color: "#abcdef" }];
    const saved = updateSpatialCameraPreviews(undefined, draft, 1), changed = structuredClone(draft);
    for (const entity of [...changed.characters, ...changed.objects, ...changed.cameras]) { entity.name = "New name"; entity.note = "Keep this location\nUse wood"; }
    // HTTP serializers and restored snapshots may reorder properties, including nested bones.
    const serialized = JSON.parse(canonicalJson(changed)) as SpatialDraft;
    expect([...availableSpatialCameraPreviews(saved, serialized)]).toEqual([["a", 1], ["b", 1]]);
    expect([...availableSpatialCameraPreviews(updateSpatialCameraPreviews(saved, serialized, 2), serialized)]).toEqual([["a", 1], ["b", 1]]);
  });

  it("uses saved snapshots when a response arrives behind newer local edits", () => {
    const draft = initial(), saved = updateSpatialCameraPreviews(undefined, draft, 1);
    const first = cameraEdit(draft, "a", { fov: 60 }), second = cameraEdit(first, "b", { width: 800 });
    const savedFirst = updateSpatialCameraPreviews(saved, first, 2);
    expect([...availableSpatialCameraPreviews(savedFirst, second)]).toEqual([["a", 2]]);
    const savedSecond = updateSpatialCameraPreviews(savedFirst, second, 3);
    expect([...availableSpatialCameraPreviews(savedSecond, second)]).toEqual([["a", 2], ["b", 3]]);
    expect([...availableSpatialCameraPreviews(savedSecond, first)]).toEqual([["a", 2]]);
    expect([...availableSpatialCameraPreviews(updateSpatialCameraPreviews(savedSecond, first, 4), first)]).toEqual([["a", 2], ["b", 4]]);
  });

  it("starts with no preview and resets revisions for a newly loaded session", () => {
    const draft = initial();
    expect(availableSpatialCameraPreviews(undefined, draft).size).toBe(0);
    expect([...availableSpatialCameraPreviews(updateSpatialCameraPreviews(undefined, draft, 1), draft)]).toEqual([["a", 1], ["b", 1]]);
  });
});
