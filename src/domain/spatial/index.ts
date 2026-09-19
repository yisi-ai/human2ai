import { Ajv2020 } from "ajv/dist/2020.js";
import maleRig from "./assets/quaternius-rig.json" with { type: "json" };
import femaleRig from "./assets/quaternius-female-rig.json" with { type: "json" };
import schema from "../../../schemas/spatial-draft.schema.json" with { type: "json" };
import { canonicalJson, fingerprintText } from "../fingerprint.ts";
import { jointWorldTransforms, solveJoint, vector, quaternion, angles, boneQuaternion, isRigidBodyConnector } from "./kinematics.ts";
import { appendFingers, completeCharacterHands, completeThumbLimits, fingerPart, fingerCurlAngles, fingerSpreadAngles, handJointIds, SPATIAL_FINGERS } from "./hands.ts";
import type { SpatialCamera, SpatialCharacter, SpatialDraft, SpatialJoint, SpatialBone, SpatialBodyType, SpatialOperation, Vec3 } from "./types.ts";
export * from "./types.ts";
export * from "./kinematics.ts";
export * from "./hands.ts";
export { BODY_SHAPE_LIMITS } from "./proportions.ts";
import { BODY_SHAPE_LIMITS } from "./proportions.ts";
import type { SpatialAppearance, SpatialBodyShape } from "./types.ts";
import { fitSpatialCameraBox } from "./camera-box.ts";
export * from "./camera-box.ts";

import operationsSchema from "../../../schemas/spatial-operations.schema.json" with { type: "json" };
const validateOperations = new Ajv2020({ allErrors: true }).compile(operationsSchema);

const validateSchema = new Ajv2020({ allErrors: true }).compile<SpatialDraft>(schema);
export const TORSO_RATIO_LIMITS = { min: 0.3, max: 0.7 } as const;
const rigTorsoRatio = (rig: typeof maleRig) => 1 - (rig.parts[0].start[1] - rig.bottom) / (rig.parts.find(p => p.id === "head")!.start[1] - rig.bottom);
export const DEFAULT_TORSO_RATIO = rigTorsoRatio(maleRig);
export class SpatialConstraintError extends Error {
  readonly code = "SPATIAL_CONSTRAINT";
}
export function createSpatialCamera(id = "camera-1", name = "Camera 1"): SpatialCamera {
  return { id, name, position: [3, 2.2, 5], target: [0, 0.9, 0], projection: "perspective", fov: 40, span: 3.2, width: 1200, height: 900, background: null };
}
export function createSpatialDraft(): SpatialDraft {
  return { version: 2, kind: "spatial-draft", lightingEnabled: false, characters: [], objects: [], cameras: [createSpatialCamera()] };
}
export function createHumanoid(id: string, name: string, height = 1.8, headRatio = 7, torsoRatio = DEFAULT_TORSO_RATIO, bodyType: SpatialBodyType = "male", bodyShape: SpatialBodyShape & { appearance?: SpatialAppearance } = {}): SpatialCharacter {
  const modelRig = bodyType === "female" ? femaleRig : maleRig;
  const naturalTorsoRatio = rigTorsoRatio(modelRig);
  const h = height - height / headRatio;
  const joints: SpatialJoint[] = [{ id: "pelvis", name: "pelvis", parentId: null, offset: [0,0,0], radius: height * .027, lockPosition: false, terminal: false }];
  const bones: SpatialBone[] = [];
  const add = (id: string, parentId: string, offset: Vec3, min: Vec3, max: Vec3, terminal = false) => {
    joints.push({ id, name: id, parentId, offset, radius: height * .025, lockPosition: false, terminal });
    bones.push({ id, name: id, startJointId: parentId, endJointId: id, rotation: [0,0,0], restRotation: [0,0,0], limits: { min, max }, lockRotation: false, modelPart: id });
  };
  add("spine", "pelvis", [0,h*.16,0], [-35,-35,-30], [45,35,30]);
  add("chest", "spine", [0,h*.17,0], [-25,-40,-25], [25,40,25]);
  add("neck", "chest", [0,h*.15,0], [-35,-45,-30], [35,45,30]);
  add("head", "neck", [0,height/headRatio,0], [-30,-45,-20], [30,45,20], true);
  for (const [side, sign] of [["left",1], ["right",-1]] as const) {
    add(`${side}-shoulder`, "chest", [sign*h*.14,0,0], [0,0,0], [0,0,0]);
    add(`${side}-elbow`, `${side}-shoulder`, [sign*h*.07,-h*.20,0], [-160,-90,-100], [160,90,100]);
    add(`${side}-wrist`, `${side}-elbow`, [sign*h*.03,-h*.20,0], [-150,-10,-10], [0,10,10]);
    add(`${side}-hand`, `${side}-wrist`, [sign*h*.02,-h*.09,0], [-70,-80,-30], [70,80,30]);
    add(`${side}-hip`, "pelvis", [sign*h*.085,0,0], [0,0,0], [0,0,0]);
    add(`${side}-knee`, `${side}-hip`, [0,-h*.25,0], [-120,-45,-45], [40,45,45]);
    add(`${side}-ankle`, `${side}-knee`, [0,-h*.25,0], [0,-10,-10], [150,10,10]);
    add(`${side}-foot`, `${side}-ankle`, [0,-h*.02,h*.09], [-35,-25,-20], [45,25,20], true);
  }
  // Use the model's anatomical landmarks, scaled below the head. Arms rest
  // in a relaxed A pose; the source mesh itself was supplied in a T pose.
  const bodyScale = h / (modelRig.parts.find(p=>p.id === "head")!.start[1] - modelRig.bottom);
  for (const joint of joints.filter(j=>j.parentId)) {
    const part = modelRig.parts.find(p=>p.id === joint.id)!;
    joint.offset = part.end.map((v,i)=>(v-part.start[i])*bodyScale) as Vec3;
    if (joint.id === "head") joint.offset = [0,height/headRatio,0];
    if (/-(elbow|wrist|hand)$/.test(joint.id)) {
      const sign = joint.id.startsWith("left") ? 1 : -1;
      joint.offset = [sign * vector(joint.offset).length() * .342, -vector(joint.offset).length() * .9397, 0];
    }
  }
  const leg = vector(joints.find(j => j.id === "left-knee")!.offset).add(vector(joints.find(j => j.id === "left-ankle")!.offset));
  const legScale = 1 + h * (naturalTorsoRatio - torsoRatio) / -leg.y;
  const torsoScale = 1 + h * (torsoRatio - naturalTorsoRatio) / (joints.find(j => j.id === "spine")!.offset[1] + joints.find(j => j.id === "chest")!.offset[1]);
  const position = vector([0,(modelRig.parts[0].start[1]-modelRig.bottom)*bodyScale,0]).addScaledVector(leg, 1 - legScale);
  for (const joint of joints) {
    const scale = ["spine", "chest"].includes(joint.id) ? torsoScale : /-(knee|ankle)$/.test(joint.id) ? legScale : 1;
    joint.offset = joint.offset.map(v => v * scale) as Vec3;
  }
  const actor: SpatialCharacter = { id, name, kind: "humanoid", position: position.toArray() as Vec3, rotation: [0,0,0], height, headRatio, torsoRatio, bodyType, thumbLimitsVersion: 2, color: "#b2a090", joints, bones, appearance: bodyShape.appearance ?? "quaternius" };
  for (const key of Object.keys(BODY_SHAPE_LIMITS) as (keyof SpatialBodyShape)[]) if (bodyShape[key] !== undefined) actor[key] = bodyShape[key];
  for (const hand of [...bones].filter(b => b.modelPart.endsWith("-hand"))) {
    joints.find(j => j.id === hand.endJointId)!.radius = height * .01;
    appendFingers(actor,hand);
  }
  return actor;
}

export function validateSpatialDraft(input: unknown): SpatialDraft {
  if (!validateSchema(input)) throw new Error(`SPATIAL_INVALID: ${validateSchema.errors?.map(e => `${e.instancePath} ${e.message}`).join("; ")}`);
  const draft = structuredClone(input);
  const ids = [...draft.characters, ...draft.objects, ...draft.cameras, ...(draft.cameraBoxes ?? [])].map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("SPATIAL_INVALID: duplicate object id");
  for (const character of draft.characters) {
    completeCharacterHands(character);
    completeThumbLimits(character);
    if (new Set(character.joints.map(j => j.id)).size !== character.joints.length || character.joints.filter(j => j.parentId === null).length !== 1) throw new Error("SPATIAL_INVALID: skeleton must have unique joints and one root");
    const children = character.joints.filter(j => j.parentId);
    if (character.bones.length !== children.length || new Set(character.bones.map(b=>b.id)).size !== character.bones.length || new Set(character.bones.map(b=>b.endJointId)).size !== children.length) throw new Error("SPATIAL_INVALID: each non-root joint requires one unique incoming bone");
    for (const bone of character.bones) {
      const end = character.joints.find(j=>j.id === bone.endJointId);
      if (!end || !end.parentId || end.parentId !== bone.startJointId) throw new Error("SPATIAL_INVALID: bone endpoints differ from joint hierarchy");
      for (const axis of [0,1,2] as const) {
        if (bone.limits.min[axis] > bone.limits.max[axis] || [bone.rotation[axis], bone.restRotation[axis]].some(v => v < bone.limits.min[axis] - 1e-7 || v > bone.limits.max[axis] + 1e-7)) throw new SpatialConstraintError(`Bone angle outside limits: ${bone.id}`);
      }
    }
    const world = jointWorldTransforms(character);
    for (const joint of character.joints) {
      if (joint.parentId && vector(joint.offset).length() < .0001) throw new Error("SPATIAL_INVALID: zero bone length");
      if (!world[joint.id].position.toArray().every(Number.isFinite)) throw new Error("SPATIAL_INVALID: non-finite transform");
    }
    if (character.kind === "humanoid") {
      const standard = createHumanoid(character.id, character.name, character.height, character.headRatio, character.torsoRatio, character.bodyType);
      if (character.joints.length !== standard.joints.length) throw new Error("SPATIAL_INVALID: humanoid structure changed without custom morphology");
      for (const expected of standard.bones) {
        const actual = character.bones.find(b=>b.id === expected.id);
        if (!actual || actual.endJointId !== expected.endJointId || actual.modelPart !== expected.modelPart || canonicalJson(actual.restRotation) !== canonicalJson(expected.restRotation)) throw new Error("SPATIAL_INVALID: modified standard bone anatomy");
      }
      for (const expected of standard.joints) {
        const actual = character.joints.find(j => j.id === expected.id);
        if (!actual || actual.parentId !== expected.parentId || actual.offset.some((v,i) => Math.abs(v - expected.offset[i]) > 1e-10)) throw new Error("SPATIAL_INVALID: modified standard humanoid anatomy");
      }
    }
  }
  for (const object of draft.objects) if (object.size.some(v => v <= 0)) throw new Error("SPATIAL_INVALID: positive object dimensions required");
  for (const camera of draft.cameras) if (vector(camera.position).distanceTo(vector(camera.target)) < 0.01) throw new Error("SPATIAL_INVALID: camera target equals position");
  return draft;
}

export function validateSpatialTransition(before: SpatialDraft, after: SpatialDraft, options: { allowLimitChanges?: boolean; resetPoseCharacterId?: string } = {}): void {
  for (const old of before.characters) {
    const next = after.characters.find(c => c.id === old.id);
    if (!next) continue;
    const oldWorld = jointWorldTransforms(old), nextWorld = jointWorldTransforms(next);
    for (const joint of old.joints) {
      const current = next.joints.find(j => j.id === joint.id);
      if (!current) continue;
      if (joint.lockPosition && current.lockPosition && oldWorld[joint.id].position.distanceTo(nextWorld[joint.id].position) > 0.00001) throw new SpatialConstraintError(`Fixed world position changed: ${joint.id}`);

    }
    for (const bone of old.bones) {
      const current = next.bones.find(b => b.id === bone.id);
      if (current && isRigidBodyConnector(bone)) {
        const reset = options.resetPoseCharacterId === old.id && canonicalJson(current.rotation) === canonicalJson(bone.restRotation);
        if (current.modelPart !== bone.modelPart || canonicalJson(current.restRotation) !== canonicalJson(bone.restRotation) || (!reset && canonicalJson(current.rotation) !== canonicalJson(bone.rotation))) throw new SpatialConstraintError(`Rigid connector rotation changed: ${bone.id}`);
        if (canonicalJson(current.limits) !== canonicalJson(bone.limits)) throw new SpatialConstraintError(`Rigid connector angle bounds changed: ${bone.id}`);
      }
      if (current && !options.allowLimitChanges && canonicalJson(current.limits) !== canonicalJson(bone.limits)) throw new SpatialConstraintError(`Use set-bone-limits to change angle bounds: ${bone.id}`);
      if (bone.lockRotation && current?.lockRotation && oldWorld[bone.endJointId].rotation.angleTo(nextWorld[current.endJointId].rotation) > .00001) throw new SpatialConstraintError(`Fixed world rotation changed: ${bone.id}`);
    }
  }
}

export function spatialDraftFingerprint(input: SpatialDraft): string {
  return fingerprintText(canonicalJson(validateSpatialDraft(input)));
}

export function applySpatialOperations(input: SpatialDraft, operations: SpatialOperation[]): { draft: SpatialDraft; constrained: boolean } {
  if (!validateOperations(operations)) throw new Error("SPATIAL_INVALID: invalid operations");
  let draft = validateSpatialDraft(input);
  let constrained = false;
  if (!Array.isArray(operations) || operations.length > 100) throw new Error("SPATIAL_INVALID: operations must be a bounded array");
  for (const operation of operations) {
    const before = structuredClone(draft);
    const character = "characterId" in operation ? draft.characters.find(c => c.id === operation.characterId) : undefined;
    if ("characterId" in operation && !character) throw new Error("SPATIAL_INVALID: unknown character");
    switch (operation.type) {
      case "set-lighting":
        draft.lightingEnabled = operation.enabled; break;
      case "add-character":
        draft.characters.push(createHumanoid(operation.id, operation.name, operation.height, operation.headRatio, operation.torsoRatio, operation.bodyType, operation)); break;
      case "put-character": {
        const index = draft.characters.findIndex(c => c.id === operation.character.id);
        if (index < 0) draft.characters.push(structuredClone(operation.character)); else draft.characters[index] = structuredClone(operation.character);
        break;
      }
      case "add-limb": {
        const actor = character!;
        if (!actor.joints.some(j => j.id === operation.parentId)) throw new Error("SPATIAL_INVALID: unknown limb attachment");
        const source = actor.joints.find(j => j.id === operation.sourceJointId);
        if (!source || !source.parentId) throw new Error("SPATIAL_INVALID: source limb must have an upstream joint");
        const descendants = [source];
        for (let i = 0; i < descendants.length; i++) descendants.push(...actor.joints.filter(j => j.parentId === descendants[i].id));
        actor.kind = "custom";
        const clonedIds = new Set(descendants.map(j=>j.id));
        const incoming = actor.bones.filter(b=>clonedIds.has(b.endJointId));
        actor.joints.push(...descendants.map((joint, i) => ({ ...structuredClone(joint), id: `${operation.idPrefix}-${joint.id}`, name: `${operation.idPrefix} ${joint.name}`, parentId: i === 0 ? operation.parentId : `${operation.idPrefix}-${joint.parentId}`, offset: i === 0 ? operation.offset : [...joint.offset] as Vec3, lockPosition: false })));
        actor.bones.push(...incoming.map(bone => ({ ...structuredClone(bone), id: `${operation.idPrefix}-${bone.id}`, name: `${operation.idPrefix} ${bone.name}`, startJointId: bone.endJointId === source.id ? operation.parentId : `${operation.idPrefix}-${bone.startJointId}`, endJointId: `${operation.idPrefix}-${bone.endJointId}`, lockRotation: false })));

        break;
      }
      case "set-proportions": {
        const actor = character!;
        const torsoRatio = operation.torsoRatio ?? actor.torsoRatio ?? DEFAULT_TORSO_RATIO;
        const bodyType = operation.bodyType ?? actor.bodyType ?? "male";
        const previous = createHumanoid(actor.id, actor.name, actor.height, actor.headRatio, actor.torsoRatio, actor.bodyType);
        const scaled = createHumanoid(actor.id, actor.name, operation.height, operation.headRatio, torsoRatio, bodyType);
        if (actor.kind === "humanoid") {
          actor.joints = scaled.joints.map(j => ({ ...actor.joints.find(old => old.id === j.id)!, offset: j.offset, radius: j.radius }));
        } else {
          for (const joint of actor.joints) {
            const role = actor.bones.find(b => b.endJointId === joint.id)?.modelPart;
            const oldPart = previous.joints.find(j => j.id === role), newPart = scaled.joints.find(j => j.id === role);
            const scale = oldPart?.parentId && newPart ? vector(newPart.offset).length() / vector(oldPart.offset).length() : operation.height / actor.height;
            joint.offset = joint.offset.map(v => v * scale) as Vec3;
            joint.radius *= operation.height / actor.height;
          }
        }
        actor.position = vector(actor.position).add(vector(scaled.position).sub(vector(previous.position)).applyQuaternion(quaternion(actor.rotation))).toArray() as Vec3;
        actor.height = operation.height; actor.headRatio = operation.headRatio; actor.torsoRatio = torsoRatio;
        actor.bodyType = bodyType;
        for (const key of Object.keys(BODY_SHAPE_LIMITS) as (keyof SpatialBodyShape)[]) if (operation[key] !== undefined) actor[key] = operation[key];
        break;
      }
      case "lock-joint": {
        const joint = character!.joints.find(j => j.id === operation.jointId);
        if (!joint) throw new Error("SPATIAL_INVALID: unknown joint");
        if (operation.position !== undefined) joint.lockPosition = operation.position;

        break;
      }
      case "reset-pose":
        character!.joints.forEach(j => { j.lockPosition = false; });
        character!.bones.forEach(b => { b.rotation = [...b.restRotation]; b.lockRotation = false; });
        break;
      case "pose-hand": case "reset-hand": {
        const actor = character!, hand = actor.bones.find(b => b.id === operation.handBoneId && b.modelPart.endsWith("-hand"));
        if (!hand) throw new Error("SPATIAL_INVALID: unknown hand");
        const ids = handJointIds(actor,hand);
        if (operation.type === "reset-hand") {
          actor.joints.filter(j => ids.has(j.id)).forEach(j => { j.lockPosition = false; });
          actor.bones.filter(b => ids.has(b.endJointId)).forEach(b => { b.rotation = [...b.restRotation]; b.lockRotation = false; });
        } else {
          for (const finger of SPATIAL_FINGERS) {
            if (operation.curl?.[finger] === undefined && !(operation.spread !== undefined && finger !== "thumb") && !(operation.thumbOpposition !== undefined && finger === "thumb")) continue;
            const chain = actor.bones.filter(b => ids.has(b.endJointId) && fingerPart(b.modelPart)?.finger === finger);
            if (chain.length !== 4) throw new Error("SPATIAL_INVALID: incomplete finger");
            for (const bone of chain) {
              const segment = fingerPart(bone.modelPart)!.segment;
              if (!segment) continue;
              const rotation: Vec3 = [...bone.rotation], curl = operation.curl?.[finger];
              const side = hand.modelPart.startsWith("left") ? 1 : -1;
              if (curl !== undefined) {
                if (finger === "thumb" && segment === 3) { rotation[0] = 0; rotation[2] = -side * curl * fingerCurlAngles(finger)[segment-1]; }
                else rotation[0] = curl * fingerCurlAngles(finger)[segment-1];
              }
              if (segment === 1 && operation.spread !== undefined && finger !== "thumb") rotation[2] = operation.spread * fingerSpreadAngles[finger] * side;
              if (segment === 1 && operation.thumbOpposition !== undefined && finger === "thumb") {
                rotation[1] = operation.thumbOpposition * 60 * side;
                rotation[2] = operation.thumbOpposition * -30 * side;
              }
              const clamped = rotation.map((v,i) => Math.max(bone.limits.min[i],Math.min(bone.limits.max[i],v))) as Vec3;
              constrained ||= clamped.some((v,i) => v !== rotation[i]);
              bone.rotation = clamped;
            }
          }
        }
        break;
      }
      case "lock-bone": case "set-bone-limits": {
        const bone = character!.bones.find(b => b.id === operation.boneId);
        if (!bone) throw new Error("SPATIAL_INVALID: unknown bone");
        if (operation.type === "lock-bone") bone.lockRotation = operation.rotation;
        else bone.limits = structuredClone(operation.limits);
        break;
      }
      case "move-joint": case "rotate-bone": {
        const bone = operation.type === "rotate-bone" ? character!.bones.find(b=>b.id === operation.boneId) : undefined;
        if (operation.type === "rotate-bone" && !bone) throw new Error("SPATIAL_INVALID: unknown bone");
        if (bone && isRigidBodyConnector(bone) && operation.type === "rotate-bone") {
          constrained ||= operation.rotation.some((v,i) => v !== bone.rotation[i]);
          break;
        }
        const clamped = operation.type === "rotate-bone" ? operation.rotation.map((v,i)=>Math.max(bone!.limits.min[i],Math.min(bone!.limits.max[i],v))) as Vec3 : undefined;
        if (clamped && operation.type === "rotate-bone") constrained ||= clamped.some((v,i)=>v !== operation.rotation[i]);
        const world = bone ? jointWorldTransforms(character!) : undefined;
        const goal = operation.type === "move-joint" ? { position: operation.position } : { rotation: angles(world![bone!.startJointId].rotation.clone().multiply(boneQuaternion(character!,bone!,clamped!))) };
        const solved = solveJoint(character!, operation.type === "move-joint" ? operation.jointId : bone!.endJointId, goal);
        draft.characters[draft.characters.indexOf(character!)] = solved.character;
        constrained ||= solved.constrained;
        if (bone && clamped) {
          const result = solved.character.bones.find(b=>b.id === bone.id)!;
          constrained ||= quaternion(result.rotation).angleTo(quaternion(clamped)) > .005;
        }
        break;
      }
      case "put-object": {
        const index = draft.objects.findIndex(o => o.id === operation.object.id);
        if (index < 0) draft.objects.push(structuredClone(operation.object)); else draft.objects[index] = structuredClone(operation.object);
        break;
      }
      case "put-camera": {
        const index = draft.cameras.findIndex(c => c.id === operation.camera.id);
        if (index < 0) draft.cameras.push(structuredClone(operation.camera)); else draft.cameras[index] = structuredClone(operation.camera);
        break;
      }
      case "put-camera-box": {
        const boxes = draft.cameraBoxes ??= [];
        const index = boxes.findIndex(box => box.id === operation.box.id);
        if (index < 0) boxes.push(structuredClone(operation.box)); else boxes[index] = structuredClone(operation.box);
        break;
      }
      case "fit-camera-box": {
        const index = draft.cameraBoxes?.findIndex(box => box.id === operation.id) ?? -1;
        if (index < 0) throw new Error("SPATIAL_INVALID: camera box not found");
        draft.cameraBoxes![index] = fitSpatialCameraBox(draft.cameraBoxes![index], draft, operation.region);
        break;
      }
      case "remove":
        draft.characters = draft.characters.filter(c => c.id !== operation.id);
        draft.objects = draft.objects.filter(o => o.id !== operation.id);
        draft.cameras = draft.cameras.filter(c => c.id !== operation.id);
        if (draft.cameraBoxes) draft.cameraBoxes = draft.cameraBoxes.filter(box => box.id !== operation.id);
        break;
      default: throw new Error("SPATIAL_INVALID: unknown operation");
    }
    draft = validateSpatialDraft(draft);
    validateSpatialTransition(before, draft, { allowLimitChanges: operation.type === "set-bone-limits", resetPoseCharacterId: operation.type === "reset-pose" ? operation.characterId : undefined });
  }
  return { draft, constrained };
}
