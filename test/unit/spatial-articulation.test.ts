import { describe, expect, it } from "vitest";
import { applySpatialOperations, createHumanoid, createSpatialDraft, jointWorldTransforms, solveJoint, validateSpatialDraft, validateSpatialTransition, type Vec3 } from "../../src/domain/spatial/index.ts";

const fixture = () => ({ ...createSpatialDraft(), characters: [createHumanoid("p", "Person")] });
const connectors = ["left-shoulder", "right-shoulder", "left-hip", "right-hip"];
describe("rigid clavicle and hip connectors", () => {
  it.each(["male", "female"] as const)("creates %s connectors with no local rotation on any axis", bodyType => {
    const actor = createHumanoid("p", "Person", 1.8, 7, undefined, bodyType);
    for (const id of connectors) expect(actor.bones.find(b => b.id === id)).toMatchObject({
      rotation: [0,0,0], limits: {min:[0,0,0],max:[0,0,0]}, lockRotation: false,
    });
  });
  it.each(connectors)("blocks all local axes on %s, including saved nonzero poses and expanded old bounds", id => {
    const draft = fixture(), bone = draft.characters[0].bones.find(b => b.id === id)!;
    bone.rotation = [5,-8,12]; bone.limits = {min:[-30,-30,-30],max:[30,30,30]};
    expect(validateSpatialDraft(draft)).toEqual(draft);
    for (const sign of [-1,1]) for (const axis of [0,1,2]) {
      const rotation = [...bone.rotation] as Vec3; rotation[axis] += sign * 5;
      const result = applySpatialOperations(draft,[{type:"rotate-bone",characterId:"p",boneId:id,rotation}]);
      expect(result.constrained).toBe(true);
      expect(result.draft).toEqual(draft);
    }
    const solved = solveJoint(draft.characters[0],id,{rotation:[20,20,20]});
    expect(solved.character).toEqual(draft.characters[0]); expect(solved.constrained).toBe(true);
    expect(() => applySpatialOperations(draft,[{type:"set-bone-limits",characterId:"p",boneId:id,limits:{min:[-90,-90,-90],max:[90,90,90]}}])).toThrow();
    const changed = structuredClone(draft); changed.characters[0].bones.find(b => b.id === id)!.rotation[0] += 1;
    expect(() => validateSpatialTransition(draft,changed)).toThrow();
    expect(() => applySpatialOperations(draft,[{type:"put-character",character:changed.characters[0]}])).toThrow();
    const reset = applySpatialOperations(draft,[{type:"reset-pose",characterId:"p"}]).draft;
    expect(reset.characters[0].bones.find(b => b.id === id)!.rotation).toEqual([0,0,0]);
  });
  it("keeps the connectors rigid through IK while arms and thighs can still articulate", () => {
    let draft = fixture();
    for (const id of ["left-elbow","right-elbow","left-knee","right-knee"]) {
      const result = applySpatialOperations(draft,[{type:"rotate-bone",characterId:"p",boneId:id,rotation:[-25,0,0]}]);
      expect(result.constrained).toBe(false);
      expect(result.draft.characters[0].bones.find(b => b.id === id)!.rotation[0]).toBeCloseTo(-25,6);
      draft = result.draft;
    }
    for (const id of connectors) {
      const bone = draft.characters[0].bones.find(b => b.id === id)!;
      bone.rotation = [3,-4,5]; bone.limits = {min:[-30,-30,-30],max:[30,30,30]};
    }
    for (const jointId of ["left-wrist","right-ankle"]) {
      const target = jointWorldTransforms(draft.characters[0])[jointId].position.toArray() as Vec3;
      target[0] += .12; target[2] += .08;
      draft = applySpatialOperations(draft,[{type:"move-joint",characterId:"p",jointId,position:target}]).draft;
      for (const id of connectors) expect(draft.characters[0].bones.find(b => b.id === id)!.rotation).toEqual([3,-4,5]);
    }
  });
  it("follows the torso in world space and honors explicit world pins without rotating the connector locally", () => {
    const draft = fixture(), before = jointWorldTransforms(draft.characters[0]);
    const moved = applySpatialOperations(draft,[{type:"rotate-bone",characterId:"p",boneId:"chest",rotation:[0,15,0]}]).draft;
    const after = jointWorldTransforms(moved.characters[0]);
    expect(after["left-shoulder"].rotation.angleTo(before["left-shoulder"].rotation)).toBeGreaterThan(.2);
    expect(moved.characters[0].bones.find(b => b.id === "left-shoulder")!.rotation).toEqual([0,0,0]);
    const pinned = applySpatialOperations(draft,[{type:"lock-bone",characterId:"p",boneId:"left-shoulder",rotation:true}]).draft;
    const result = applySpatialOperations(pinned,[{type:"rotate-bone",characterId:"p",boneId:"chest",rotation:[0,15,0]}]);
    expect(() => validateSpatialTransition(pinned,result.draft)).not.toThrow();
    expect(result.draft.characters[0].bones.find(b => b.id === "left-shoulder")!.rotation).toEqual([0,0,0]);
  });
  it("keeps cloned connectors rigid and cannot bypass the rule by changing modelPart", () => {
    const draft = applySpatialOperations(fixture(),[{type:"add-limb",characterId:"p",sourceJointId:"left-shoulder",parentId:"chest",idPrefix:"extra",offset:[.2,-.2,0]}]).draft;
    const result = applySpatialOperations(draft,[{type:"rotate-bone",characterId:"p",boneId:"extra-left-shoulder",rotation:[15,15,15]}]);
    expect(result.draft).toEqual(draft); expect(result.constrained).toBe(true);
    const actor = structuredClone(draft.characters[0]); actor.bones.find(b => b.id === "extra-left-shoulder")!.modelPart = "left-elbow";
    expect(() => applySpatialOperations(draft,[{type:"put-character",character:actor}])).toThrow();
    actor.bones.find(b => b.id === "extra-left-shoulder")!.modelPart = "left-shoulder";
    actor.bones.find(b => b.id === "extra-left-shoulder")!.restRotation = [10,0,0];
    expect(() => validateSpatialTransition(draft,{...draft,characters:[actor]})).toThrow();
  });
});
describe("joint and bone authoring", () => {
  it("rotates an upper arm about its shoulder without moving the other arm or changing lengths", () => {
    const draft = fixture(), before = jointWorldTransforms(draft.characters[0]);
    const result = applySpatialOperations(draft, [{ type: "rotate-bone", characterId: "p", boneId: "left-elbow", rotation: [0, 0, -40] }]);
    const after = jointWorldTransforms(result.draft.characters[0]);
    expect(after["left-shoulder"].position.distanceTo(before["left-shoulder"].position)).toBeLessThan(1e-8);
    expect(after["right-wrist"].position.distanceTo(before["right-wrist"].position)).toBeLessThan(1e-8);
    expect(after["left-elbow"].position.distanceTo(before["left-elbow"].position)).toBeGreaterThan(.1);
    expect(after["left-elbow"].position.distanceTo(after["left-shoulder"].position)).toBeCloseTo(before["left-elbow"].position.distanceTo(before["left-shoulder"].position), 8);
  });
  it("keeps fixed joint positions and bone orientations through ancestor changes and raw saves", () => {
    const draft = applySpatialOperations(fixture(), [
      { type: "lock-joint", characterId: "p", jointId: "right-wrist", position: true },
      { type: "lock-bone", characterId: "p", boneId: "right-wrist", rotation: true },
    ]).draft;
    const result = applySpatialOperations(draft, [{ type: "rotate-bone", characterId: "p", boneId: "spine", rotation: [0, 10, 0] }]);
    expect(() => validateSpatialTransition(draft, result.draft)).not.toThrow();
    const invalid = structuredClone(draft); invalid.characters[0].position[0] += 1;
    expect(() => validateSpatialTransition(draft, invalid)).toThrow(/Fixed world position/);
  });
  it("enforces all six angle bounds and keeps a reachable default pose", () => {
    const bounds = { min: [-20, -10, -5] as [number,number,number], max: [30, 15, 25] as [number,number,number] };
    const draft = applySpatialOperations(fixture(), [{ type: "set-bone-limits", characterId: "p", boneId: "left-elbow", limits: bounds }]).draft;
    for (const rotation of [[-60,-60,-60], [60,60,60]] as [number,number,number][]) {
      const result = applySpatialOperations(draft, [{ type: "rotate-bone", characterId: "p", boneId: "left-elbow", rotation }]);
      const bone = result.draft.characters[0].bones.find(b => b.id === "left-elbow")!;
      expect(result.constrained).toBe(true);
      bone.rotation.forEach((v,i) => { expect(v).toBeGreaterThanOrEqual(bounds.min[i]); expect(v).toBeLessThanOrEqual(bounds.max[i]); });
    }
    expect(() => applySpatialOperations(draft, [{ type: "set-bone-limits", characterId: "p", boneId: "left-elbow", limits: { min: [10,0,0], max: [20,0,0] } }])).toThrow();
  });
  it("restores pose and clears locks while retaining placement, proportions, four arms and two heads", () => {
    const draft = fixture(); draft.characters[0].position[0] = 2;
    const posed = applySpatialOperations(draft, [
      { type: "add-limb", characterId: "p", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "extra-left", offset: [.2,-.2,0] },
      { type: "add-limb", characterId: "p", sourceJointId: "right-shoulder", parentId: "chest", idPrefix: "extra-right", offset: [-.2,-.2,0] },
      { type: "add-limb", characterId: "p", sourceJointId: "neck", parentId: "chest", idPrefix: "extra-head", offset: [.18,.2,0] },
      { type: "rotate-bone", characterId: "p", boneId: "extra-left-left-elbow", rotation: [20,0,-30] },
      { type: "lock-joint", characterId: "p", jointId: "left-wrist", position: true },
      { type: "lock-bone", characterId: "p", boneId: "left-hand", rotation: true },
    ]).draft;
    const restored = applySpatialOperations(posed, [{ type: "reset-pose", characterId: "p" }]).draft.characters[0];
    expect(restored.position).toEqual(posed.characters[0].position);
    expect(restored.joints.map(j=>j.id)).toEqual(posed.characters[0].joints.map(j=>j.id));
    expect(restored.height).toBe(posed.characters[0].height);
    expect(restored.joints.every(j=>!j.lockPosition)).toBe(true);
    expect(restored.bones.every(b=>!b.lockRotation && b.rotation.every((v,i)=>v===b.restRotation[i]))).toBe(true);
    expect(validateSpatialDraft({ ...posed, characters: [restored] })).toBeTruthy();
  });
});

it("does not allow a raw save to bypass explicit angle-limit editing", () => {
  const draft=fixture(), changed=structuredClone(draft);
  changed.characters[0].bones[0].limits.min[0]=-180;
  expect(()=>validateSpatialTransition(draft,changed)).toThrow(/set-bone-limits/);
});

it("rescales duplicated heads while retaining their morphology", () => {
  const draft=applySpatialOperations(fixture(),[{type:"add-limb",characterId:"p",sourceJointId:"neck",parentId:"chest",idPrefix:"second",offset:[.2,.2,0]}]).draft;
  const before=draft.characters[0].joints.find(j=>j.id==="second-head")!.offset[1];
  const after=applySpatialOperations(draft,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:3.5}]).draft;
  expect(after.characters[0].joints.find(j=>j.id==="second-head")!.offset[1]).toBeCloseTo(before*2,8);
});

it("keeps a rotated segment pivot fixed even when a downstream point is pinned",()=>{
  const draft=applySpatialOperations(fixture(),[{type:"lock-joint",characterId:"p",jointId:"left-wrist",position:true}]).draft;
  const before=jointWorldTransforms(draft.characters[0]);
  const result=applySpatialOperations(draft,[{type:"rotate-bone",characterId:"p",boneId:"left-elbow",rotation:[-20,0,-20]}]);
  const after=jointWorldTransforms(result.draft.characters[0]);
  expect(after["left-shoulder"].position.distanceTo(before["left-shoulder"].position)).toBeLessThan(1e-8);
  expect(after["left-wrist"].position.distanceTo(before["left-wrist"].position)).toBeLessThan(1e-5);
  expect(after.chest.rotation.angleTo(before.chest.rotation)).toBeLessThan(1e-8);
});
