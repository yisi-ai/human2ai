import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { applySpatialOperations, createHumanoid, createSpatialDraft, jointWorldTransforms, validateSpatialDraft } from "../../src/domain/spatial/index.ts";
import { fingerBasis, SPATIAL_FINGERS } from "../../src/domain/spatial/hands.ts";

const fixture = (heads = 7, bodyType: "male" | "female" = "male") => ({ ...createSpatialDraft(), characters: [createHumanoid("p","Person",1.8,heads,undefined,bodyType)] });
describe("articulated hands", () => {
  it.each(["male","female"] as const)("adds five independently articulated fingers to %s", bodyType => {
    const draft = fixture(3,bodyType), actor = draft.characters[0];
    expect(validateSpatialDraft(draft)).toEqual(draft);
    for (const side of ["left","right"]) for (const finger of SPATIAL_FINGERS) {
      expect(actor.joints.find(j => j.id === `${side}-${finger}-3`)?.terminal).toBe(true);
      expect(actor.bones.find(b => b.id === `${side}-${finger}-2`)?.limits.max).toEqual([110,0,finger === "thumb" ? 45 : 0]);
    }
    const next = applySpatialOperations(draft,[{ type: "pose-hand", characterId: "p", handBoneId: "left-hand", curl: { index: 1 } }]).draft;
    const before = jointWorldTransforms(actor), after = jointWorldTransforms(next.characters[0]);
    expect(after["left-index-3"].position.distanceTo(before["left-index-3"].position)).toBeGreaterThan(.03);
    for (const id of ["head","left-wrist","left-hand","left-middle-3","right-index-3"]) expect(after[id].position.distanceTo(before[id].position)).toBeLessThan(1e-8);
  });
  it.each(["male","female"] as const)("rotates %s thumb phalanges around blue Z without moving the palm or neighboring fingers", bodyType => {
    for (const heads of [2,7]) for (const side of ["left","right"]) for (const segment of [2,3]) {
      const draft = fixture(heads,bodyType), actor = draft.characters[0], before = jointWorldTransforms(actor);
      const id = `${side}-thumb-${segment}`, bone = actor.bones.find(b => b.id === id)!;
      const z = side === "left" ? -30 : 30;
      const result = applySpatialOperations(draft,[{type:"rotate-bone",characterId:"p",boneId:id,rotation:[0,0,z]}]);
      expect(result.constrained).toBe(false);
      const after = jointWorldTransforms(result.draft.characters[0]);
      const pivot = before[bone.startJointId].position;
      const axis = new Vector3(0,0,1).applyQuaternion(fingerBasis(actor,bone)).applyQuaternion(before[bone.startJointId].rotation);
      const expected = before[id].position.clone().sub(pivot).applyAxisAngle(axis,z*Math.PI/180).add(pivot);
      expect(after[id].position.distanceTo(expected)).toBeLessThan(1e-8);
      expect(after[id].position.distanceTo(before[id].position)).toBeGreaterThan(.005);
      for (const joint of [`${side}-hand`,`${side}-wrist`,`${side}-index-3`,bone.startJointId]) expect(after[joint].position.distanceTo(before[joint].position)).toBeLessThan(1e-8);
      if (segment === 3) {
        const blocked = applySpatialOperations(draft,[{type:"rotate-bone",characterId:"p",boneId:id,rotation:[30,0,0]}]);
        expect(blocked.constrained).toBe(true);
        expect(blocked.draft.characters[0].bones.find(b => b.id === id)!.rotation.every(v=>Math.abs(v)<1e-8)).toBe(true);
      }
    }
  });
  it("curls the distal thumb on mirrored Z, retaining proximal Z and respecting rotation pins", () => {
    for (const side of ["left","right"]) {
      const draft = applySpatialOperations(fixture(),[{type:"rotate-bone",characterId:"p",boneId:`${side}-thumb-2`,rotation:[0,0,20]}]).draft;
      const operation = {type:"pose-hand" as const,characterId:"p",handBoneId:`${side}-hand`,curl:{thumb:1}};
      const result = applySpatialOperations(draft,[operation]);
      expect(result.constrained).toBe(false);
      expect(result.draft.characters[0].bones.find(b=>b.id===`${side}-thumb-3`)!.rotation).toEqual([0,0,side === "left" ? -55 : 55]);
      const proximal=result.draft.characters[0].bones.find(b=>b.id===`${side}-thumb-2`)!.rotation;
      expect(proximal[0]).toBe(50); expect(proximal[2]).toBeCloseTo(20,5);
      const pinned = applySpatialOperations(draft,[{type:"lock-bone",characterId:"p",boneId:`${side}-thumb-3`,rotation:true}]).draft;
      expect(() => applySpatialOperations(pinned,[operation])).toThrow(/Fixed world rotation/);
    }
  });
  it("corrects saved thumb defaults once without changing poses, pins, or explicitly edited limits", () => {
    const source = applySpatialOperations(fixture(),[{type:"add-limb",characterId:"p",sourceJointId:"left-shoulder",parentId:"chest",idPrefix:"extra",offset:[.2,-.2,0]}]).draft;
    const actor = source.characters[0]; delete actor.thumbLimitsVersion;
    for (const bone of actor.bones.filter(b=>/-thumb-[23]$/.test(b.modelPart))) {
      bone.limits = {min:[0,0,0],max:[bone.modelPart.endsWith("2")?110:90,0,0]};
      bone.rotation = [25,0,0]; bone.lockRotation = true;
    }
    const custom = actor.bones.find(b=>b.id==="right-thumb-2")!; custom.limits.max=[70,0,0];
    const before=jointWorldTransforms(actor), original=structuredClone(source), next=validateSpatialDraft(source), after=jointWorldTransforms(next.characters[0]);
    expect(source).toEqual(original);
    expect(next.characters[0].bones.find(b=>b.id===custom.id)).toEqual(custom);
    for (const joint of actor.joints) {
      expect(after[joint.id].position.distanceTo(before[joint.id].position)).toBeLessThan(1e-8);
      expect(after[joint.id].rotation.angleTo(before[joint.id].rotation)).toBeLessThan(1e-7);
    }
    expect(next.characters[0].bones.find(b=>b.id==="extra-left-thumb-3")!.limits).toEqual({min:[0,0,-90],max:[25,0,0]});
    expect(next.characters[0].bones.map(b=>b.lockRotation)).toEqual(actor.bones.map(b=>b.lockRotation));
    expect(validateSpatialDraft(next)).toEqual(next);
    const explicit = applySpatialOperations(next,[{type:"set-bone-limits",characterId:"p",boneId:"left-thumb-3",limits:{min:[0,0,0],max:[90,0,0]}}]).draft;
    expect(validateSpatialDraft(explicit).characters[0].bones.find(b=>b.id==="left-thumb-3")!.limits.max).toEqual([90,0,0]);
    const invalid=structuredClone(source); invalid.characters[0].bones.find(b=>b.id==="left-thumb-3")!.rotation[0]=100;
    expect(()=>validateSpatialDraft(invalid)).toThrow(/outside limits/);
  });
  it("does not pull the arm toward unreachable fingertips or violate pins", () => {
    const draft = fixture(), actor = draft.characters[0], before = jointWorldTransforms(actor);
    const result = applySpatialOperations(draft,[{ type: "move-joint", characterId: "p", jointId: "left-index-3", position: [5,5,5] }]);
    expect(result.constrained).toBe(true);
    const after = jointWorldTransforms(result.draft.characters[0]);
    for (const id of ["pelvis","left-shoulder","left-wrist","left-hand","left-middle-3"]) expect(after[id].position.distanceTo(before[id].position)).toBeLessThan(1e-8);
    const pinned = applySpatialOperations(draft,[{ type: "lock-joint", characterId: "p", jointId: "left-index-3", position: true }]).draft;
    expect(() => applySpatialOperations(pinned,[{ type: "pose-hand", characterId: "p", handBoneId: "left-hand", curl: { index: 1 } }])).toThrow(/Fixed world position/);
    expect(pinned.characters[0].bones.find(b => b.id === "left-index-1")!.rotation).toEqual([0,0,0]);
    const fixedRotation = applySpatialOperations(draft,[{ type:"lock-bone",characterId:"p",boneId:"left-index-2",rotation:true }]).draft;
    expect(() => applySpatialOperations(fixedRotation,[{ type:"pose-hand",characterId:"p",handBoneId:"left-hand",curl:{index:.6} }])).toThrow(/Fixed world rotation/);
  });
  it("rejects malformed hand commands without changing the source draft", () => {
    const draft = fixture(), saved = structuredClone(draft);
    for (const patch of [{ curl:{middle:1.01} },{ curl:{toe:.5} },{ handBoneId:"left-wrist",spread:.5 },{}]) {
      const operation = {type:"pose-hand",characterId:"p",handBoneId:"left-hand",...patch};
      expect(() => applySpatialOperations(draft,[operation as Parameters<typeof applySpatialOperations>[1][number]])).toThrow(/SPATIAL_INVALID/);
    }
    expect(draft).toEqual(saved);
  });
  it.each([2,3,7])("reaches a finger target at %s heads with unchanged bone lengths and neighboring digits", heads => {
    const draft = fixture(heads);
    const posed = applySpatialOperations(draft,[{ type:"pose-hand",characterId:"p",handBoneId:"right-hand",curl:{index:.5} }]).draft.characters[0];
    const target = jointWorldTransforms(posed)["right-index-3"].position;
    const result = applySpatialOperations(draft,[{ type:"move-joint",characterId:"p",jointId:"right-index-3",position:target.toArray() }]);
    const after = jointWorldTransforms(result.draft.characters[0]), before = jointWorldTransforms(draft.characters[0]);
    expect(after["right-index-3"].position.distanceTo(target)).toBeLessThan(.003);
    expect(after["right-middle-3"].position.distanceTo(before["right-middle-3"].position)).toBeLessThan(1e-8);
    expect(result.draft.characters[0].joints).toEqual(draft.characters[0].joints);
  });
  it("spreads both hands outward and opposes the thumb at its base", () => {
    const draft = fixture();
    const next = applySpatialOperations(draft,[{ type:"pose-hand",characterId:"p",handBoneId:"left-hand",spread:1,thumbOpposition:1 },{ type:"pose-hand",characterId:"p",handBoneId:"right-hand",spread:1,thumbOpposition:1 }]).draft;
    const before = jointWorldTransforms(draft.characters[0]), after = jointWorldTransforms(next.characters[0]);
    for (const side of ["left","right"]) {
      const a = `${side}-index-3`, b = `${side}-little-3`;
      expect(after[a].position.distanceTo(after[b].position)).toBeGreaterThan(before[a].position.distanceTo(before[b].position)*1.4);
      expect(after[`${side}-thumb-1`].position.distanceTo(before[`${side}-thumb-1`].position)).toBeGreaterThan(.01);
    }
  });
  it("adds fingers to saved v2 hands without moving body poses or releasing a fixed former hand tip", () => {
    const source = fixture(3), actor = source.characters[0];
    actor.joints = actor.joints.filter(j => !/-(thumb|index|middle|ring|little)-\d$/.test(j.id));
    actor.bones = actor.bones.filter(b => !/-(thumb|index|middle|ring|little)-\d$/.test(b.id));
    for (const side of ["left","right"]) {
      const j = actor.joints.find(j => j.id === `${side}-hand`)!;
      j.offset = j.offset.map(v => v/.35) as typeof j.offset; j.terminal = true; j.lockPosition = true;
      actor.bones.find(b => b.id === j.id)!.rotation = [20,30,0];
    }
    const before = jointWorldTransforms(actor), restored = validateSpatialDraft(source), after = jointWorldTransforms(restored.characters[0]);
    for (const id of ["pelvis","left-wrist","right-wrist","head"]) expect(after[id].position.distanceTo(before[id].position)).toBeLessThan(1e-8);
    for (const side of ["left","right"]) {
      expect(after[`${side}-middle-3`].position.distanceTo(before[`${side}-hand`].position)).toBeLessThan(1e-8);
      expect(restored.characters[0].joints.find(j => j.id === `${side}-middle-3`)!.lockPosition).toBe(true);
    }
    expect(validateSpatialDraft(restored)).toEqual(restored);
    expect(source.characters[0].joints).toHaveLength(21);
  });
  it("resets only the selected hand and clones all five fingers with an arm", () => {
    const posed = applySpatialOperations(fixture(),[
      { type: "rotate-bone", characterId: "p", boneId: "left-elbow", rotation: [15,0,10] },
      { type: "pose-hand", characterId: "p", handBoneId: "left-hand", curl: { index: .7, thumb: .5 }, thumbOpposition: .6 },
      { type: "pose-hand", characterId: "p", handBoneId: "right-hand", curl: { little: 1 } },
      { type: "lock-bone", characterId: "p", boneId: "left-index-2", rotation: true },
    ]).draft;
    const reset = applySpatialOperations(posed,[{ type: "reset-hand", characterId: "p", handBoneId: "left-hand" }]).draft.characters[0];
    expect(reset.bones.find(b => b.id === "left-index-2")!.lockRotation).toBe(false);
    expect(reset.bones.find(b => b.id === "left-index-2")!.rotation).toEqual([0,0,0]);
    for (const id of ["left-elbow","right-little-1"]) expect(reset.bones.find(b => b.id === id)).toEqual(posed.characters[0].bones.find(b => b.id === id));
    const cloned = applySpatialOperations(posed,[{ type: "add-limb", characterId: "p", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "extra", offset: [.2,-.2,0] }]).draft;
    for (const finger of SPATIAL_FINGERS) expect(cloned.characters[0].joints.some(j => j.id === `extra-left-${finger}-3`)).toBe(true);
    expect(() => applySpatialOperations(cloned,[{ type: "pose-hand", characterId: "p", handBoneId: "extra-left-hand", curl: { middle: 1 } }])).not.toThrow();
  });
});
