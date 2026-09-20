import { Matrix4, Quaternion, Vector3 } from "three";
import maleRig from "./assets/quaternius-rig.json" with { type: "json" };
import femaleRig from "./assets/quaternius-female-rig.json" with { type: "json" };
import { spatialShape } from "./proportions.ts";
import type { SpatialBone, SpatialCharacter, SpatialJoint, Vec3 } from "./types.ts";

export const SPATIAL_FINGERS = ["thumb", "index", "middle", "ring", "little"] as const;
export type SpatialFinger = typeof SPATIAL_FINGERS[number];
export function fingerPart(part: string) {
  const match = /^(left|right)-(thumb|index|middle|ring|little)-([0-3])$/.exec(part);
  return match ? { side: match[1], finger: match[2] as SpatialFinger, segment: Number(match[3]) } : null;
}
export const isHandPart = (part: string) => part.endsWith("-hand") || Boolean(fingerPart(part));
export const handRig = (actor: SpatialCharacter) => actor.bodyType === "female" ? femaleRig : maleRig;

function thumbLimits(side: string, segment: number): SpatialBone["limits"] {
  return segment === 2 ? { min: [0,0,-45], max: [110,0,45] }
    : { min: [0,0,side === "left" ? -90 : 0], max: [0,0,side === "left" ? 0 : 90] };
}

/** Correct only untouched defaults once, keeping stored angles and custom bounds. */
export function completeThumbLimits(actor: SpatialCharacter): void {
  if (actor.thumbLimitsVersion === 2) return;
  for (const bone of actor.bones) {
    const part = fingerPart(bone.modelPart);
    if (part?.finger !== "thumb" || part.segment < 2) continue;
    const oldMax = [part.segment === 2 ? 110 : 90,0,0];
    if (!bone.limits.min.every(v => v === 0) || !bone.limits.max.every((v,i) => v === oldMax[i])) continue;
    // Invalid stored angles must still fail validation, rather than widening
    // the corrected limits to accommodate malformed input.
    if ([bone.rotation,bone.restRotation].some(values => values.some((v,i) => v < 0 || v > oldMax[i]))) continue;
    bone.limits = thumbLimits(part.side,part.segment);
    if (part.segment === 3) bone.limits.max[0] = Math.max(bone.rotation[0],bone.restRotation[0]);
  }
  actor.thumbLimitsVersion = 2;
}

export function owningHand(actor: SpatialCharacter, bone: SpatialBone): SpatialBone | undefined {
  let current: SpatialBone | undefined = bone;
  while (current) {
    if (current.modelPart.endsWith("-hand")) return current;
    current = actor.bones.find(b => b.endJointId === current!.startJointId);
  }
}

/** Linear source-to-rest map shared by the palm, finger offsets and skin. */
export function handRestMatrix(actor: SpatialCharacter, hand: SpatialBone, shaped = true): Matrix4 {
  const rig = handRig(actor), source = rig.parts.find(p => p.id === hand.modelPart)!;
  const direction = new Vector3(...source.end as Vec3).sub(new Vector3(...source.start as Vec3));
  const offset = new Vector3(...actor.joints.find(j => j.id === hand.endJointId)!.offset);
  const scale = offset.length() / direction.length(), shape = spatialShape(actor.headRatio);
  const palmSize = shaped ? actor.palmSize ?? 1 : 1;
  const width = shaped ? actor.height / rig.height * shape.hand * palmSize : scale;
  const up = new Vector3(0,1,0);
  return new Matrix4().compose(new Vector3(), new Quaternion().setFromUnitVectors(up, offset.normalize()), new Vector3(width, scale * (shaped ? shape.handLength : 1) * palmSize, width))
    .multiply(new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(up,direction.normalize()).invert()));
}

/** Palm size sets thickness; a separate axial factor sets digit length. */
export function fingerRestMatrix(actor: SpatialCharacter, hand: SpatialBone, modelPart: string): Matrix4 {
  const rest = handRestMatrix(actor,hand);
  if (fingerPart(modelPart)?.segment === 0 || (actor.fingerLength ?? 1) === (actor.palmSize ?? 1)) return rest;
  const part = handRig(actor).parts.find(p => p.id === modelPart)!;
  const direction = new Vector3(...part.end as Vec3).sub(new Vector3(...part.start as Vec3)).normalize();
  const frame = new Matrix4().makeRotationFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction));
  return rest.multiply(frame).multiply(new Matrix4().makeScale(1,(actor.fingerLength ?? 1) / (actor.palmSize ?? 1),1)).multiply(frame.clone().invert());
}

/** Finger angles use anatomical hinge axes, expressed in the parent's rest frame. */
export function fingerBasis(actor: SpatialCharacter, bone: SpatialBone): Quaternion {
  const finger = fingerPart(bone.modelPart), hand = finger && owningHand(actor,bone);
  if (!finger || !hand || finger.segment === 0) return new Quaternion();
  const part = handRig(actor).parts.find(p => p.id === bone.modelPart)!;
  const y = new Vector3(...part.end as Vec3).sub(new Vector3(...part.start as Vec3)).normalize();
  const x = y.clone().cross(new Vector3(0,-1,0)).normalize(), z = x.clone().cross(y).normalize();
  const rest = handRestMatrix(actor,hand,false);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x.transformDirection(rest), y.transformDirection(rest), z.transformDirection(rest)));
}

export function fingerOffset(actor: SpatialCharacter, joint: SpatialJoint, hand: SpatialBone): Vector3 {
  const part = actor.bones.find(b => b.endJointId === joint.id)!.modelPart;
  const map = fingerRestMatrix(actor,hand,part).multiply(handRestMatrix(actor,hand,false).invert());
  return new Vector3(...joint.offset).applyMatrix4(map);
}

export function handJointIds(actor: SpatialCharacter, hand: SpatialBone): Set<string> {
  const ids = new Set([hand.endJointId]);
  for (const id of ids) for (const joint of actor.joints.filter(j => j.parentId === id)) ids.add(joint.id);
  return ids;
}

/** Add the source's five chains to a palm, including a fixed attachment per digit. */
export function appendFingers(actor: SpatialCharacter, hand: SpatialBone): void {
  const rig = handRig(actor), rest = handRestMatrix(actor,hand,false);
  const prefix = hand.id.endsWith(hand.modelPart) ? hand.id.slice(0,-hand.modelPart.length) : `${hand.id}-`;
  const side = hand.modelPart.startsWith("left") ? "left" : "right";
  for (const finger of SPATIAL_FINGERS) for (let segment = 0; segment < 4; segment++) {
    const modelPart = `${side}-${finger}-${segment}`, id = `${prefix}${modelPart}`;
    const source = rig.parts.find(p => p.id === modelPart)!;
    const parentId = segment ? `${prefix}${side}-${finger}-${segment-1}` : hand.endJointId;
    const offset = new Vector3(...source.end as Vec3).sub(new Vector3(...source.start as Vec3)).applyMatrix4(rest).toArray() as Vec3;
    const min: Vec3 = segment === 0 ? [0,0,0] : segment === 1 ? [-10,finger === "thumb" ? -70 : 0, finger === "thumb" ? -35 : -20] : [0,0,0];
    const max: Vec3 = segment === 0 ? [0,0,0] : segment === 1 ? [95,finger === "thumb" ? 70 : 0,finger === "thumb" ? 35 : 20] : [segment === 2 ? 110 : 90,0,0];
    actor.joints.push({ id, name: id, parentId, offset, radius: actor.height * .004, terminal: segment === 3, lockPosition: false });
    const limits = finger === "thumb" && segment >= 2 ? thumbLimits(side,segment) : { min,max };
    actor.bones.push({ id, name: id, startJointId: parentId, endJointId: id, rotation: [0,0,0], restRotation: [0,0,0], limits, lockRotation: false, modelPart });
  }
}

/** Complete only the current v2 Quaternius palm data; no retired model support. */
export function completeCharacterHands(actor: SpatialCharacter): void {
  for (const hand of actor.bones.filter(b => b.modelPart === "left-hand" || b.modelPart === "right-hand")) {
    const end = actor.joints.find(j => j.id === hand.endJointId);
    if (!end?.terminal || actor.joints.some(j => j.parentId === end.id)) continue;
    end.offset = end.offset.map(v => v * .35) as Vec3;
    end.terminal = false; end.radius = actor.height * .01;
    const pinnedTip = end.lockPosition; end.lockPosition = false;
    appendFingers(actor,hand);
    if (pinnedTip) {
      const tip = actor.bones.find(b => b.modelPart === hand.modelPart.replace("hand","middle-3") && handJointIds(actor,hand).has(b.endJointId))!;
      actor.joints.find(j => j.id === tip.endJointId)!.lockPosition = true;
    }
  }
}

export const fingerCurlAngles = (finger: SpatialFinger) => finger === "thumb" ? [35,50,55] : [70,95,65];
export const fingerSpreadAngles: Record<SpatialFinger,number> = { thumb: 0, index: 16, middle: 4, ring: -7, little: -18 };
