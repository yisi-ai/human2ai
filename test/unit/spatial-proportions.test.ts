import { describe, expect, it } from "vitest";
import { applySpatialOperations, createHumanoid, createSpatialDraft, DEFAULT_TORSO_RATIO, jointWorldTransforms, TORSO_RATIO_LIMITS, validateSpatialDraft, vector } from "../../src/domain/spatial/index.ts";
import { renderSpatialPng } from "../../src/server/spatial-render.ts";

const fixture = () => ({ ...createSpatialDraft(), characters: [createHumanoid("p", "Person")] });
const resize = (draft: ReturnType<typeof fixture>, torsoRatio: number) => applySpatialOperations(draft, [{ type: "set-proportions", characterId: "p", height: draft.characters[0].height, headRatio: draft.characters[0].headRatio, torsoRatio }]).draft;
const offset = (actor: ReturnType<typeof createHumanoid>, id: string) => actor.joints.find(j => j.id === id)!.offset;

describe("linked torso and leg proportions", () => {
  it.each(["male", "female"] as const)("preserves %s height and visible torso/legs at both limits across head ratios", bodyType => {
    for (const headRatio of [2, 2.5, 2.7, 3, 3.5, 4, 7, 12]) for (const torsoRatio of [TORSO_RATIO_LIMITS.min, TORSO_RATIO_LIMITS.max]) {
      const standard = createHumanoid("p", "Person", 1.8, headRatio, undefined, bodyType);
      const actor = createHumanoid("p", "Person", 1.8, headRatio, torsoRatio, bodyType);
      const world = jointWorldTransforms(actor), original = jointWorldTransforms(standard);
      expect(world.head.position.y).toBeCloseTo(actor.height, 10);
      expect(world.head.position.distanceTo(world.neck.position)).toBeCloseTo(actor.height / headRatio, 10);
      expect((world.neck.position.y - world.pelvis.position.y) / (actor.height - actor.height / headRatio)).toBeCloseTo(torsoRatio, 10);
      expect(world.pelvis.position.y / (actor.height - actor.height / headRatio)).toBeCloseTo(1 - torsoRatio, 10);
      for (const id of ["neck", "head", "left-elbow", "left-wrist", "left-hand", "left-foot", "right-foot"]) expect(offset(actor, id)).toEqual(offset(standard, id));
      expect(vector(offset(actor, "left-knee")).length() / vector(offset(standard, "left-knee")).length()).toBeCloseTo(vector(offset(actor, "left-ankle")).length() / vector(offset(standard, "left-ankle")).length(), 10);
      expect(world["left-foot"].position.distanceTo(original["left-foot"].position)).toBeLessThan(1e-8);
      expect(world.neck.position.y - world.pelvis.position.y).toBeGreaterThan(.2);
      expect(world.pelvis.position.y).toBeGreaterThan(.2);
    }
  });

  it("makes legs longer to the left and preserves a kicking pose and custom limbs", () => {
    const draft = applySpatialOperations(fixture(), [
      { type: "rotate-bone", characterId: "p", boneId: "left-knee", rotation: [-78,0,5] },
      { type: "add-limb", characterId: "p", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "lower", offset: [.22,-.2,0] },
      { type: "add-limb", characterId: "p", sourceJointId: "neck", parentId: "chest", idPrefix: "second", offset: [.22,.23,0] },
    ]).draft;
    const longer = resize(draft, .3), shorter = resize(draft, .7);
    expect(vector(offset(longer.characters[0], "left-knee")).length()).toBeGreaterThan(vector(offset(shorter.characters[0], "left-knee")).length());
    expect(longer.characters[0].bones).toEqual(draft.characters[0].bones);
    expect(longer.characters[0].joints.map(j => j.id)).toEqual(draft.characters[0].joints.map(j => j.id));
    for (const id of ["left-hand", "lower-left-hand", "second-head", "left-foot"]) expect(offset(longer.characters[0], id)).toEqual(offset(draft.characters[0], id));
    const reset = resize(longer, DEFAULT_TORSO_RATIO);
    reset.characters[0].joints.forEach((j,i) => j.offset.forEach((v,axis) => expect(v).toBeCloseTo(draft.characters[0].joints[i].offset[axis], 10)));
    expect(reset.characters[0].bones).toEqual(draft.characters[0].bones);
    expect(reset.cameras).toEqual(draft.cameras);
  });

  it("preserves the chosen ratio on later height/head edits and pose resets", () => {
    const draft = resize(fixture(), .3);
    const changed = applySpatialOperations(draft, [{ type: "set-proportions", characterId: "p", height: 2, headRatio: 8 }]).draft;
    expect(changed.characters[0].torsoRatio).toBe(.3);
    const reset = applySpatialOperations(changed, [{ type: "reset-pose", characterId: "p" }]).draft;
    expect(reset.characters[0].torsoRatio).toBe(.3);
    expect(reset.characters[0].joints).toEqual(changed.characters[0].joints);
    const withoutRatio = fixture(); delete withoutRatio.characters[0].torsoRatio;
    expect(validateSpatialDraft(withoutRatio)).toEqual(withoutRatio);
    expect(resize(withoutRatio, DEFAULT_TORSO_RATIO).characters[0].joints).toEqual(withoutRatio.characters[0].joints);
  });

  it("refuses to move fixed joints and keeps fixed orientations without unlocking", () => {
    const pinned = applySpatialOperations(fixture(), [{ type: "lock-joint", characterId: "p", jointId: "pelvis", position: true }]).draft;
    const saved = structuredClone(pinned);
    expect(() => resize(pinned, .3)).toThrow(/Fixed world position/);
    expect(pinned).toEqual(saved);
    const standing = applySpatialOperations(fixture(), [
      { type: "lock-joint", characterId: "p", jointId: "right-ankle", position: true },
      { type: "lock-bone", characterId: "p", boneId: "left-hand", rotation: true },
    ]).draft;
    const changed = resize(standing, .3), before = jointWorldTransforms(standing.characters[0]), after = jointWorldTransforms(changed.characters[0]);
    expect(after["right-ankle"].position.distanceTo(before["right-ankle"].position)).toBeLessThan(1e-5);
    expect(after["left-hand"].rotation.angleTo(before["left-hand"].rotation)).toBeLessThan(1e-8);
    expect(changed.characters[0].bones.find(b => b.id === "left-hand")!.lockRotation).toBe(true);
  });

  it("enforces limits on Agent operations and complete documents", () => {
    for (const torsoRatio of [0, .299, .701, 1]) {
      expect(() => resize(fixture(), torsoRatio)).toThrow();
      const invalid = fixture(); invalid.characters[0].torsoRatio = torsoRatio;
      expect(() => validateSpatialDraft(invalid)).toThrow();
    }
    const mismatched = fixture(); mismatched.characters[0].torsoRatio = .3;
    expect(() => validateSpatialDraft(mismatched)).toThrow(/anatomy/);
  });

  it("renders the new proportions in the output camera", async () => {
    const draft = fixture(); draft.cameras[0].width = 256; draft.cameras[0].height = 256;
    const longer = resize(draft, .3), shorter = resize(draft, .7);
    expect(await renderSpatialPng(longer, longer.cameras[0])).not.toEqual(await renderSpatialPng(shorter, shorter.cameras[0]));
  });
});
