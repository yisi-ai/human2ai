import { describe, expect, it } from "vitest";
import { applySpatialOperations, createHumanoid, createSpatialCameraBox, createSpatialDraft, spatialDraftFingerprint, validateSpatialDraft, type SpatialDraft, type SpatialOperation } from "../../src/domain/spatial/index.ts";

const fixture = (): SpatialDraft => ({
  ...createSpatialDraft(),
  characters: [createHumanoid("person", "Person")],
  objects: [{ id: "desk", name: "Desk", kind: "box", position: [0, .5, 0], rotation: [0, 0, 0], size: [2, 1, 1], color: "#abcdef" }],
  cameraBoxes: [createSpatialCameraBox("box", "Observation box")],
});
const note = "这是弧形接待台\n保留占地范围，背后留出通道。";

describe("spatial object notes", () => {
  it("keeps old v2 drafts unchanged and round-trips notes on every top-level entity", () => {
    const draft = fixture();
    expect(validateSpatialDraft(draft)).toEqual(draft);
    const operations: SpatialOperation[] = [
      { type: "put-character", character: { ...draft.characters[0], note } },
      { type: "put-object", object: { ...draft.objects[0], note } },
      { type: "put-camera", camera: { ...draft.cameras[0], note } },
      { type: "put-camera-box", box: { ...draft.cameraBoxes![0], note } },
    ];
    const saved = applySpatialOperations(draft, operations).draft;
    expect(validateSpatialDraft(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    for (const entity of [...saved.characters, ...saved.objects, ...saved.cameras, ...saved.cameraBoxes!]) expect(entity.note).toBe(note);
    expect(spatialDraftFingerprint(saved)).not.toBe(spatialDraftFingerprint(draft));
    expect(draft.objects[0].note).toBeUndefined();
    const cleared = applySpatialOperations(saved, [{ type: "put-object", object: { ...saved.objects[0], note: "" } }]).draft;
    expect(cleared.objects[0].note).toBe("");
    expect(cleared.characters[0].note).toBe(note);
  });

  it("preserves notes through pose reset, proportions and observation-box fitting", () => {
    const draft = fixture(); draft.characters[0].note = note; draft.cameraBoxes![0].note = note;
    const saved = applySpatialOperations(draft, [
      { type: "set-proportions", characterId: "person", height: 2, headRatio: 6 },
      { type: "reset-pose", characterId: "person" },
      { type: "fit-camera-box", id: "box", region: "scene" },
    ]).draft;
    expect(saved.characters[0].note).toBe(note);
    expect(saved.cameraBoxes![0].note).toBe(note);
  });

  it.each([null, 42, {}, []])("rejects non-text notes (%j) without changing the source", invalid => {
    const draft = fixture(), original = structuredClone(draft);
    for (const field of ["characters", "objects", "cameras", "cameraBoxes"] as const) {
      const changed = structuredClone(draft);
      Object.assign(changed[field]![0], { note: invalid });
      expect(() => validateSpatialDraft(changed)).toThrow("SPATIAL_INVALID");
    }
    expect(() => applySpatialOperations(draft, [{ type: "put-object", object: { ...draft.objects[0], note: invalid } } as unknown as SpatialOperation])).toThrow("SPATIAL_INVALID");
    expect(draft).toEqual(original);
  });
});
