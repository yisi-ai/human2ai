import { describe, expect, it } from "vitest";
import {
  applySpatialOperations, createSpatialDraft, createHumanoid, jointWorldTransforms,
  validateSpatialDraft, validateSpatialTransition,
} from "../../src/domain/spatial/index.js";

function fixture() {
  const draft = createSpatialDraft();
  draft.characters.push(createHumanoid("person", "Person"));
  return draft;
}

describe("spatial pose constraints", () => {
  it("supports independent cameras and preserves their framing while posing", () => {
    const draft = fixture();
    const result = applySpatialOperations(draft, [{ type: "move-joint", characterId: "person", jointId: "left-wrist", position: [0.6, 1.3, 0.3] }]);
    expect(result.draft.cameras).toEqual(draft.cameras);
    expect(validateSpatialDraft(result.draft)).toEqual(result.draft);
  });

  it("keeps locked world positions while moving other joints", () => {
    let draft = fixture();
    draft = applySpatialOperations(draft, [{ type: "lock-joint", characterId: "person", jointId: "right-wrist", position: true }]).draft;
    const before = jointWorldTransforms(draft.characters[0]);
    const result = applySpatialOperations(draft, [{ type: "move-joint", characterId: "person", jointId: "left-wrist", position: [0.6, 1.3, 0.3] }]);
    const after = jointWorldTransforms(result.draft.characters[0]);
    expect(after["right-wrist"].position.distanceTo(before["right-wrist"].position)).toBeLessThan(0.0001);
    expect(after["left-wrist"].position.distanceTo(before["left-wrist"].position)).toBeGreaterThan(0.05);
    expect(() => validateSpatialTransition(draft, result.draft)).not.toThrow();
  });

  it("rotation locking allows position changes and position locking allows rotation", () => {
    let draft = fixture();
    draft = applySpatialOperations(draft, [{ type: "lock-bone", characterId: "person", boneId: "left-hand", rotation: true }]).draft;
    const before = jointWorldTransforms(draft.characters[0])["left-hand"];
    const next = applySpatialOperations(draft, [{ type: "move-joint", characterId: "person", jointId: "left-wrist", position: [0.6, 1.3, 0.3] }]).draft;
    const after = jointWorldTransforms(next.characters[0])["left-hand"];
    expect(after.rotation.angleTo(before.rotation)).toBeLessThan(0.0001);
    expect(after.position.distanceTo(before.position)).toBeGreaterThan(0.03);
    const pinned = applySpatialOperations(fixture(), [{ type: "lock-joint", characterId: "person", jointId: "left-wrist", position: true }]).draft;
    const turned = applySpatialOperations(pinned, [{ type: "rotate-bone", characterId: "person", boneId: "left-hand", rotation: [20, 0, 0] }]).draft;
    expect(jointWorldTransforms(turned.characters[0])["left-wrist"].position.distanceTo(jointWorldTransforms(pinned.characters[0])["left-wrist"].position)).toBeLessThan(0.0001);
    expect(jointWorldTransforms(turned.characters[0])["left-hand"].rotation.angleTo(jointWorldTransforms(pinned.characters[0])["left-hand"].rotation)).toBeGreaterThan(0.1);
  });

  it("reports an unreachable locked target without changing the skeleton", () => {
    const draft = applySpatialOperations(fixture(), [{ type: "lock-joint", characterId: "person", jointId: "left-wrist", position: true }]).draft;
    const result = applySpatialOperations(draft, [{ type: "move-joint", characterId: "person", jointId: "left-wrist", position: [20, 20, 20] }]);
    expect(result.constrained).toBe(true);
    expect(result.draft).toEqual(draft);
  });

  it("rejects invalid joint limits and direct saves that move fixed joints", () => {
    const draft = fixture();
    const invalid = structuredClone(draft);
    invalid.characters[0].bones.find(j => j.id === "left-ankle")!.rotation = [-30, 0, 0];
    expect(() => validateSpatialDraft(invalid)).toThrow();
    const pinned = applySpatialOperations(draft, [{ type: "lock-joint", characterId: "person", jointId: "head", position: true }]).draft;
    const moved = structuredClone(pinned);
    moved.characters[0].position[0] += 1;
    expect(() => validateSpatialTransition(pinned, moved)).toThrow();
  });

  it("creates an editable four-arm morphology through explicit Agent operations", () => {
    const source = fixture();
    const result = applySpatialOperations(source, [{ type: "add-limb", characterId: "person", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "lower-left", offset: [0.24, -0.2, 0] }, { type: "add-limb", characterId: "person", sourceJointId: "right-shoulder", parentId: "chest", idPrefix: "lower-right", offset: [-0.24, -0.2, 0] }]);
    expect(result.draft.characters[0].kind).toBe("custom");
    expect(result.draft.characters[0].joints).toHaveLength(source.characters[0].joints.length + 48);
    expect(() => validateSpatialDraft(result.draft)).not.toThrow();
    const bad = structuredClone(result.draft);
    bad.characters[0].joints[0].parentId = bad.characters[0].joints[1].id;
    expect(() => validateSpatialDraft(bad)).toThrow();
  });
});
