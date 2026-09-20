import { describe, expect, it } from "vitest";
import { Mesh, Vector3 } from "three";
import { applySpatialOperations, BODY_SHAPE_LIMITS, createHumanoid, createSpatialDraft, fingerPart, jointWorldTransforms, proportionedJointOffset, validateSpatialDraft, validateSpatialTransition, type SpatialBodyShape, type SpatialCharacter, type SpatialDraft } from "../../src/domain/spatial/index.ts";
import { createCharacterModel } from "../../src/domain/spatial/model.ts";
import { renderSpatialPng } from "../../src/server/spatial-render.ts";

const draftOf = (actor = createHumanoid("p", "Person")): SpatialDraft => ({ ...createSpatialDraft(), characters: [actor] });
const resize = (draft: SpatialDraft, patch: SpatialBodyShape) => applySpatialOperations(draft, [{ type: "set-proportions", characterId: draft.characters[0].id, height: draft.characters[0].height, headRatio: draft.characters[0].headRatio, ...patch }]).draft;
const offset = (actor: SpatialCharacter, id: string) => proportionedJointOffset(actor, actor.joints.find(j => j.id === id)!);
const vertices = (actor: SpatialCharacter, part: string) => {
  const model = createCharacterModel(actor), result: Vector3[] = [];
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if (object.userData.modelPart === part) {
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) result.push(new Vector3().fromBufferAttribute(positions,i));
    }
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
  return result;
};

describe("actor-wide neck, palm, finger and foot dimensions", () => {
  it.each(["male", "female"] as const)("moves the %s head along the neck without resizing or moving the torso", bodyType => {
    for (const heads of [2,2.5,3,3.5,7,12]) for (const torsoRatio of [.3,.7]) {
      const before = createHumanoid("p","Person",1.8,heads,torsoRatio,bodyType), original = jointWorldTransforms(before);
      for (const neckLength of [.6,1.4]) {
        const actor = resize(draftOf(before),{ neckLength }).characters[0], world = jointWorldTransforms(actor);
        const movement = offset(before,"neck").multiplyScalar(neckLength - 1);
        expect(world.head.position.clone().sub(original.head.position).distanceTo(movement)).toBeLessThan(1e-9);
        expect(world.neck.position.clone().sub(original.neck.position).distanceTo(movement)).toBeLessThan(1e-9);
        expect(offset(actor,"head")).toEqual(offset(before,"head"));
        expect(offset(actor,"neck").length() / offset(before,"neck").length()).toBeCloseTo(neckLength,10);
        for (const joint of actor.joints.filter(j => !["neck","head"].includes(j.id))) {
          expect(offset(actor,joint.id)).toEqual(offset(before,joint.id));
          expect(world[joint.id].position.toArray()).toEqual(original[joint.id].position.toArray());
        }
        expect(actor.bones).toEqual(before.bones);
      }
    }
  });

  it.each(["male", "female"] as const)("scales %s palms and digits independently on both sides and cloned hands", bodyType => {
    for (const heads of [2,3,7]) {
      const before = applySpatialOperations(draftOf(createHumanoid("p","Person",1.8,heads,undefined,bodyType)), [
        { type: "add-limb", characterId: "p", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "lower", offset: [.2,-.2,0] },
        { type: "pose-hand", characterId: "p", handBoneId: "left-hand", curl: { index: .5, thumb: .3 }, spread: .4 },
      ]).draft;
      for (const [palmSize,fingerLength] of [[.7,1.4],[1.3,.6],[1.3,1],[1,.6]]) {
        const actor = resize(before,{ palmSize,fingerLength }).characters[0];
        for (const bone of actor.bones) {
          const finger = fingerPart(bone.modelPart);
          const factor = finger ? finger.segment === 0 ? palmSize : fingerLength : bone.modelPart.endsWith("-hand") ? palmSize : 1;
          expect(offset(actor,bone.endJointId).length() / offset(before.characters[0],bone.endJointId).length()).toBeCloseTo(factor,9);
        }
        expect(actor.bones).toEqual(before.characters[0].bones);
        const oldWorld = jointWorldTransforms(before.characters[0]), world = jointWorldTransforms(actor);
        for (const side of ["left","right","lower-left"]) expect(world[`${side}-wrist`].position.distanceTo(oldWorld[`${side}-wrist`].position)).toBeLessThan(1e-9);
      }
    }
  });

  it("gives larger feet more height and raises both ankles while retaining the soles and knees", () => {
    for (const bodyType of ["male","female"] as const) for (const heads of [2,3,7]) {
      const actor = createHumanoid("p","Person",1.8,heads,undefined,bodyType), before = vertices(actor,"left-foot");
      for (const footSize of [.7,1.4]) {
        const next = resize(draftOf(actor),{ footSize }).characters[0], after = vertices(next,"left-foot");
        const original = jointWorldTransforms(actor), world = jointWorldTransforms(next);
        for (const side of ["left","right"]) {
          const oldOffset = offset(actor,`${side}-foot`), newOffset = offset(next,`${side}-foot`);
          const lift = world[`${side}-ankle`].position.y - original[`${side}-ankle`].position.y;
          expect(lift * (footSize - 1)).toBeGreaterThan(0);
          expect(Math.abs(lift)).toBeLessThan(actor.height * .025);
          expect((Math.abs(newOffset.y) - Math.abs(oldOffset.y)) * (footSize - 1)).toBeGreaterThan(0);
          expect(newOffset.z / oldOffset.z).toBeCloseTo(footSize,10);
          expect(world[`${side}-knee`].position).toEqual(original[`${side}-knee`].position);
          expect(world[`${side}-ankle`].position.x).toBe(original[`${side}-ankle`].position.x);
          expect(world[`${side}-ankle`].position.z).toBe(original[`${side}-ankle`].position.z);
        }
        expect(world["left-ankle"].position.y - original["left-ankle"].position.y).toBeCloseTo(world["right-ankle"].position.y - original["right-ankle"].position.y,8);
        expect(after).toHaveLength(before.length);
        const bottom = (points: Vector3[]) => Math.min(...points.map(p => p.y));
        // Heel/ankle weights blend into the calf; keep the sole within 0.2%
        // of character height (under one pixel in the full-body review PNG).
        expect(Math.abs(bottom(after) - bottom(before))).toBeLessThan(actor.height * .002);
        const top = (points: Vector3[]) => Math.max(...points.map(p => p.y));
        expect((top(after) - top(before)) * (footSize - 1)).toBeGreaterThan(0);
        const length = (points: Vector3[]) => Math.max(...points.map(p => p.z)) - Math.min(...points.map(p => p.z));
        // Ankle weights blend the heel attachment into the unchanged leg.
        expect(length(after) / length(before)).toBeCloseTo(footSize,1);
      }
    }
  });

  it("preserves omitted defaults, selected factors through later edits, and pose resets", async () => {
    const before = draftOf(), defaults = resize(before,{ neckLength: 1, palmSize: 1, fingerLength: 1, footSize: 1 });
    expect(jointWorldTransforms(defaults.characters[0])).toEqual(jointWorldTransforms(before.characters[0]));
    const camera = { ...before.cameras[0], width: 128, height: 128 };
    expect(await renderSpatialPng(defaults,camera)).toEqual(await renderSpatialPng(before,camera));
    const factors = { neckLength: .8, palmSize: 1.2, fingerLength: .7, footSize: 1.3 };
    const changed = resize(before,factors);
    const later = applySpatialOperations(changed,[{ type: "set-proportions", characterId: "p", height: 2, headRatio: 3, torsoRatio: .3, bodyType: "female" }, { type: "reset-pose", characterId: "p" }, { type: "reset-hand", characterId: "p", handBoneId: "left-hand" }]).draft;
    expect(later.characters[0]).toMatchObject(factors);
    expect(await renderSpatialPng(changed,camera)).not.toEqual(await renderSpatialPng(before,camera));
  });

  it("moves posed and cloned heads in their neck direction while retaining the body mesh", () => {
    const draft = applySpatialOperations(draftOf(),[
      { type: "add-limb", characterId: "p", sourceJointId: "neck", parentId: "chest", idPrefix: "second", offset: [.22,.23,0] },
      { type: "rotate-bone", characterId: "p", boneId: "neck", rotation: [25,20,10] },
      { type: "rotate-bone", characterId: "p", boneId: "second-neck", rotation: [-20,0,15] },
    ]).draft;
    const before = draft.characters[0], actor = resize(draft,{ neckLength: 1.4 }).characters[0];
    const original = jointWorldTransforms(before), world = jointWorldTransforms(actor);
    for (const prefix of ["","second-"]) {
      const neck = `${prefix}neck`, head = `${prefix}head`;
      const movement = offset(before,neck).multiplyScalar(.4).applyQuaternion(original[neck].rotation);
      expect(world[head].position.clone().sub(original[head].position).distanceTo(movement)).toBeLessThan(1e-9);
      expect(world[head].rotation.angleTo(original[head].rotation)).toBeLessThan(1e-8);
    }
    expect(vertices(actor,"spine")).toEqual(vertices(before,"spine"));
    expect(actor.bones).toEqual(before.bones);
  });

  it("retains posed leg angles and applies ankle height to cloned feet", () => {
    const draft = applySpatialOperations(draftOf(),[
      { type: "add-limb", characterId: "p", sourceJointId: "left-knee", parentId: "left-hip", idPrefix: "extra", offset: [.2,-.4,0] },
      { type: "rotate-bone", characterId: "p", boneId: "left-ankle", rotation: [100,0,0] },
      { type: "rotate-bone", characterId: "p", boneId: "left-foot", rotation: [15,0,0] },
    ]).draft;
    const before = draft.characters[0], actor = resize(draft,{ footSize: 1.4 }).characters[0];
    expect(actor.bones).toEqual(before.bones);
    for (const prefix of ["left","right","extra-left"]) expect(offset(actor,`${prefix}-ankle`).y).toBeGreaterThan(offset(before,`${prefix}-ankle`).y);
    const original = jointWorldTransforms(before), world = jointWorldTransforms(actor);
    for (const id of ["head","chest","left-knee","right-knee","extra-left-knee"]) expect(world[id].position).toEqual(original[id].position);
    expect(vertices(actor,"left-foot").every(v => v.toArray().every(Number.isFinite))).toBe(true);
  });

  it("rejects fixed-position conflicts atomically through operations and whole-document saves", () => {
    for (const [key,id] of [["neckLength","head"],["palmSize","left-hand"],["fingerLength","right-index-3"],["footSize","left-ankle"],["footSize","left-foot"]] as const) {
      const draft = applySpatialOperations(draftOf(),[{ type: "lock-joint", characterId: "p", jointId: id, position: true }]).draft;
      const saved = structuredClone(draft);
      expect(() => resize(draft,{ [key]: 1.2 })).toThrow(/Fixed world position/);
      const raw = structuredClone(draft); raw.characters[0][key] = 1.2;
      expect(() => validateSpatialTransition(draft,validateSpatialDraft(raw))).toThrow(/Fixed world position/);
      expect(draft).toEqual(saved);
    }
    const draft = applySpatialOperations(draftOf(),[{ type: "lock-bone", characterId: "p", boneId: "left-index-1", rotation: true }]).draft;
    const next = resize(draft,{ palmSize: 1.2, fingerLength: .8 }), a = jointWorldTransforms(draft.characters[0]), b = jointWorldTransforms(next.characters[0]);
    expect(b["left-index-1"].rotation.angleTo(a["left-index-1"].rotation)).toBeLessThan(1e-8);
    expect(next.characters[0].bones.find(bone => bone.id === "left-index-1")!.lockRotation).toBe(true);
    const fixedTorso = applySpatialOperations(draftOf(),[{ type: "lock-joint", characterId: "p", jointId: "chest", position: true }]).draft;
    expect(() => resize(fixedTorso,{ neckLength: 1.4 })).not.toThrow();
  });

  it("enforces the same bounds in add, proportion edits, raw characters and draft schemas", () => {
    for (const key of Object.keys(BODY_SHAPE_LIMITS) as (keyof SpatialBodyShape)[]) {
      const { min,max } = BODY_SHAPE_LIMITS[key];
      for (const value of [min,max]) {
        expect(resize(draftOf(),{ [key]: value }).characters[0][key]).toBe(value);
        expect(applySpatialOperations(createSpatialDraft(),[{ type: "add-character", id: "p", name: "Person", [key]: value }]).draft.characters[0][key]).toBe(value);
      }
      for (const value of [0,min-.01,max+.01]) {
        expect(() => resize(draftOf(),{ [key]: value })).toThrow(/SPATIAL_INVALID/);
        expect(() => applySpatialOperations(createSpatialDraft(),[{ type: "add-character", id: "p", name: "Person", [key]: value }])).toThrow(/SPATIAL_INVALID/);
        const invalid = draftOf(); invalid.characters[0][key] = value;
        expect(() => validateSpatialDraft(invalid)).toThrow(/SPATIAL_INVALID/);
        expect(() => applySpatialOperations(draftOf(),[{ type: "put-character", character: invalid.characters[0] }])).toThrow(/SPATIAL_INVALID/);
      }
    }
    expect(() => validateSpatialDraft({ ...draftOf(), characters: [{ ...createHumanoid("p","Person"), leftPalmSize: 1.2 }] })).toThrow(/SPATIAL_INVALID/);
  });

  it("can still position a resized fingertip without moving the arm or other digits", () => {
    for (const bodyType of ["male","female"] as const) for (const heads of [2,7]) {
      const draft = resize(draftOf(createHumanoid("p","Person",1.8,heads,undefined,bodyType)),{ palmSize: 1.3, fingerLength: .6 });
      const target = applySpatialOperations(draft,[{ type: "pose-hand", characterId: "p", handBoneId: "left-hand", curl: { index: .25 } }]).draft;
      const goal = jointWorldTransforms(target.characters[0])["left-index-3"].position;
      const result = applySpatialOperations(draft,[{ type: "move-joint", characterId: "p", jointId: "left-index-3", position: goal.toArray() as [number,number,number] }]);
      expect(result.constrained).toBe(false);
      expect(jointWorldTransforms(result.draft.characters[0])["left-index-3"].position.distanceTo(goal)).toBeLessThan(.0009);
      for (const bone of draft.characters[0].bones.filter(b => !b.id.startsWith("left-index-"))) expect(result.draft.characters[0].bones.find(b => b.id === bone.id)).toEqual(bone);
    }
  });
});
