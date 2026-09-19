import { Euler, Quaternion, Vector3 } from "three";
import type { SpatialBone, SpatialCharacter, SpatialJoint, Vec3 } from "./types.ts";
import { footHeightScale, partWidth, spatialShape } from "./proportions.ts";
import { fingerPart, fingerBasis, fingerOffset, owningHand } from "./hands.ts";
import maleRig from "./assets/quaternius-rig.json" with { type: "json" };
import femaleRig from "./assets/quaternius-female-rig.json" with { type: "json" };

const DEG = Math.PI / 180;
export const vector = (value: Vec3) => new Vector3(...value);
export const quaternion = (value: Vec3) => new Quaternion().setFromEuler(new Euler(...value.map(v => v * DEG) as Vec3, "XYZ"));
export const angles = (value: Quaternion): Vec3 => {
  const e = new Euler().setFromQuaternion(value, "XYZ");
  return [e.x / DEG, e.y / DEG, e.z / DEG];
};
export interface JointTransform { position: Vector3; rotation: Quaternion }
// These attachment segments follow their parent, without a local rotational DOF.
// Match the source part so duplicated limbs obey the same rule.
export const isRigidBodyConnector = (bone: SpatialBone) => /^(left|right)-(shoulder|hip)$/.test(bone.modelPart);
export function boneQuaternion(actor: SpatialCharacter, bone: SpatialBone, rotation = bone.rotation): Quaternion {
  const basis = fingerBasis(actor,bone);
  return basis.clone().multiply(quaternion(rotation)).multiply(basis.invert());
}
export function boneAngles(actor: SpatialCharacter, bone: SpatialBone, rotation: Quaternion): Vec3 {
  const basis = fingerBasis(actor,bone);
  return angles(basis.clone().invert().multiply(rotation).multiply(basis));
}

// Stored offsets describe the anatomical rig. Apply the head-count width at
// torso and shoulder/hip attachments before posing so mesh and controls align.
export function proportionedJointOffset(character: SpatialCharacter, joint: SpatialJoint): Vector3 {
  const offset = vector(joint.offset);
  const part = character.bones.find(b => b.endJointId === joint.id)?.modelPart;
  if (part && fingerPart(part)) {
    const bone = character.bones.find(b => b.endJointId === joint.id)!;
    const hand = owningHand(character,bone);
    if (hand) return fingerOffset(character,joint,hand);
  }
  const shape = spatialShape(character.headRatio);
  if (part && (["spine", "chest", "neck"].includes(part) || /-(shoulder|hip)$/.test(part))) {
    const width = partWidth(shape, part) * 6 * character.headRatio / (7 * (character.headRatio - 1));
    offset.x *= width;
    // Thickness describes a skin cross-section. Scaling the rest spine's
    // sagittal offsets by it would exaggerate the curve as height shrinks.
    const depth = shape.torsoDepth * 6 * character.headRatio / (7 * (character.headRatio - 1));
    offset.z *= 1 + (depth - 1) * (1 - shape.softness);
  }
  const neckLength = character.neckLength ?? 1;
  if (part === "neck") offset.multiplyScalar(shape.neck * neckLength);
  if (part === "spine" || part === "chest") {
    const neck = character.joints.find(j => j.id === "neck");
    if (neck) {
      offset.y += neck.offset[1] * (1 - shape.neck) / 2;
      offset.z += neck.offset[2] * (1 - shape.neck) * shape.torsoDepth * 6 * character.headRatio / (7 * (character.headRatio - 1)) / 2 * (1 - shape.softness);
    }
  }
  if (part && /-(elbow|wrist)$/.test(part)) offset.multiplyScalar(shape.armLength);
  if (part?.endsWith("-hand")) offset.multiplyScalar(shape.handLength * (character.palmSize ?? 1));
  const footHeight = footHeightScale(character.footSize);
  if (part?.endsWith("-ankle") && footHeight !== 1) {
    const foot = character.bones.find(b => b.startJointId === joint.id && b.modelPart.endsWith("-foot"));
    if (foot) {
      const rig = character.bodyType === "female" ? femaleRig : maleRig;
      const source = rig.parts.find(p => p.id === foot.modelPart)!;
      const end = character.joints.find(j => j.id === foot.endJointId)!;
      const scale = vector(end.offset).length() / vector(source.end as Vec3).sub(vector(source.start as Vec3)).length();
      // Raise the ankle within the leg, keeping the knee/body in place. The
      // same anatomical sole height anchors the foot's mild vertical growth.
      offset.y += (source.start[1] - rig.bottom) * scale * (footHeight - 1);
    }
  }
  if (part?.endsWith("-foot")) { offset.x *= character.footSize ?? 1; offset.y *= footHeight; offset.z *= shape.footLength * (character.footSize ?? 1); }
  return offset;
}

type RestTransforms = Record<string, { offset: Vector3; basis: Quaternion }>;
export function jointWorldTransforms(character: SpatialCharacter, rest?: RestTransforms): Record<string, JointTransform> {
  const result: Record<string, JointTransform> = Object.create(null);
  const joints = new Map(character.joints.map(joint => [joint.id, joint]));
  const incoming = new Map(character.bones.map(bone => [bone.endJointId, bone]));
  const visiting = new Set<string>();
  const resolve = (id: string): JointTransform => {
    if (result[id]) return result[id];
    if (visiting.has(id)) throw new Error("SPATIAL_INVALID: cyclic skeleton");
    visiting.add(id);
    const joint = joints.get(id);
    if (!joint) throw new Error("SPATIAL_INVALID: missing parent joint");
    const parent = joint.parentId ? resolve(joint.parentId) : { position: vector(character.position), rotation: quaternion(character.rotation) };
    const bone = incoming.get(id);
    const basis = rest?.[id].basis;
    const local = bone ? basis ? basis.clone().multiply(quaternion(bone.rotation)).multiply(basis.clone().invert()) : boneQuaternion(character,bone) : new Quaternion();
    const rotation = parent.rotation.clone().multiply(local).normalize();
    const position = (rest?.[id].offset.clone() ?? proportionedJointOffset(character, joint)).applyQuaternion(rotation).add(parent.position);
    visiting.delete(id);
    return result[id] = { position, rotation };
  };
  character.joints.forEach(joint => resolve(joint.id));
  return result;
}

export function boneWorldTransforms(character: SpatialCharacter): Record<string, JointTransform> {
  const world = jointWorldTransforms(character);
  return Object.fromEntries(character.bones.map(b => [b.id, { position: world[b.startJointId].position.clone(), rotation: world[b.endJointId].rotation.clone() }]));
}

interface Target { id: string; position?: Vector3; rotation?: Quaternion; weight: number }

// Damped least squares over the articulated hierarchy. Limits are projected after
// every step; pinned targets receive a separate final solve and hard validation.
export function solveJoint(
  source: SpatialCharacter, jointId: string,
  goal: { position?: Vec3; rotation?: Vec3 },
  isolated = true,
): { character: SpatialCharacter; constrained: boolean } {
  const character = structuredClone(source);
  const selected = character.joints.find(j => j.id === jointId);
  if (!selected) throw new Error("SPATIAL_INVALID: unknown joint");
  const selectedBone = character.bones.find(b => b.endJointId === jointId);
  const fingerOnly = Boolean(selectedBone && fingerPart(selectedBone.modelPart));
  const rest: RestTransforms = Object.fromEntries(character.joints.map(j => {
    const b = character.bones.find(b => b.endJointId === j.id);
    return [j.id,{ offset: proportionedJointOffset(character,j), basis: b ? fingerBasis(character,b) : new Quaternion() }];
  }));
  const worldNow = () => jointWorldTransforms(character,rest);
  const initial = jointWorldTransforms(source);
  if ((goal.position && selected.lockPosition) || (goal.rotation && selectedBone && (selectedBone.lockRotation || isRigidBodyConnector(selectedBone)))) {
    return { character: source, constrained: true };
  }
  const pins: Target[] = [
    ...source.joints.filter(j => j.lockPosition).map(j => ({ id: j.id, weight: 100, position: initial[j.id].position })),
    ...source.bones.filter(b => b.lockRotation).map(b => ({ id: b.endJointId, weight: 100, rotation: initial[b.endJointId].rotation })),
  ];
  const desired: Target = { id: jointId, weight: 1,
    ...(goal.position ? { position: vector(goal.position) } : {}),
    ...(goal.rotation ? { rotation: quaternion(goal.rotation) } : {}),
  };
  if (desired.rotation && selectedBone) {
    const parent = selected.parentId ? initial[selected.parentId].rotation : quaternion(source.rotation);
    const local = boneAngles(character,selectedBone,parent.clone().invert().multiply(desired.rotation));
    if (local.every((v, axis) => v >= selectedBone.limits.min[axis] && v <= selectedBone.limits.max[axis])) {
      selectedBone.rotation = local;
      const world = worldNow();
      if (pins.every(pin => (!pin.position || pin.position.distanceTo(world[pin.id].position) < 0.00001)
        && (!pin.rotation || pin.rotation.angleTo(world[pin.id].rotation) < 0.00001))) return { character, constrained: false };
      selectedBone.rotation = [...source.bones.find(b => b.endJointId === jointId)!.rotation];
    }
  }
  const chain = new Set<string>();
  let ancestor: string | null = jointId;
  while (ancestor) {
    chain.add(ancestor);
    const joint = character.joints.find(j=>j.id===ancestor)!;
    ancestor = joint.parentId;
    if (ancestor && character.joints.filter(j=>j.parentId===ancestor).length > 1) break;
  }
  const rotationChain = new Set([jointId]);
  for (const id of rotationChain) for (const child of character.joints.filter(j=>j.parentId===id)) rotationChain.add(child.id);
  const variables: { get(): number; set(v: number): void; step: number }[] = [];
  for (const joint of character.bones) {
    if (joint.lockRotation || isRigidBodyConnector(joint) || (desired.rotation ? !rotationChain.has(joint.endJointId) : isolated && !chain.has(joint.endJointId))) continue;
    for (const axis of [0, 1, 2] as const) {
      if (joint.limits.max[axis] - joint.limits.min[axis] < 0.0001) continue;
      variables.push({ get: () => joint.rotation[axis], set: v => { joint.rotation[axis] = Math.max(joint.limits.min[axis], Math.min(joint.limits.max[axis], v)); }, step: 0.05 });
    }
  }
  if (!selected.parentId) for (const axis of [0, 1, 2] as const) {
    variables.push({ get: () => character.position[axis], set: v => { character.position[axis] = v; }, step: 0.001 });
  }
  const residual = (targets: Target[]) => {
    // A locked world orientation determines this joint's local orientation from
    // its parent; eliminate those degrees instead of balancing a soft penalty.
    const pending = new Set(character.bones.filter(b => b.lockRotation && !isRigidBodyConnector(b)).map(b => b.id));
    const applyRotationPin = (id: string) => {
      const bone = character.bones.find(b => b.id === id)!;
      const parentBone = character.bones.find(b => b.endJointId === bone.startJointId);
      if (parentBone && pending.has(parentBone.id)) applyRotationPin(parentBone.id);
      const world = worldNow();
      const parent = world[bone.startJointId].rotation;
      bone.rotation = boneAngles(character,bone,parent.clone().invert().multiply(initial[bone.endJointId].rotation)).map((v, axis) => Math.max(bone.limits.min[axis], Math.min(bone.limits.max[axis], v))) as Vec3;
      pending.delete(id);
    };
    for (const id of pending) applyRotationPin(id);
    const world = worldNow();
    const values: number[] = [];
    for (const target of targets) {
      if (target.position) values.push(...target.position.clone().sub(world[target.id].position).multiplyScalar(target.weight).toArray());
      if (target.rotation) {
        const delta = target.rotation.clone().multiply(world[target.id].rotation.clone().invert()).normalize();
        const sign = delta.w < 0 ? -1 : 1;
        values.push(delta.x * 2 * sign * target.weight, delta.y * 2 * sign * target.weight, delta.z * 2 * sign * target.weight);
      }
    }
    return values;
  };
  const energy = (values: number[]) => values.reduce((sum, value) => sum + value * value, 0);
  const optimize = (targets: Target[], iterations: number) => {
    for (let iteration = 0; iteration < iterations; iteration++) {
      const error = residual(targets);
      const score = energy(error);
      if (score < 1e-12) break;
      const base = variables.map(v => v.get());
      const jacobian = variables.map((variable, i) => {
        variable.set(base[i] + variable.step);
        let actual = variable.get() - base[i];
        if (Math.abs(actual) < 1e-10) { variable.set(base[i] - variable.step); actual = variable.get() - base[i]; }
        const changed = residual(targets);
        variable.set(base[i]);
        return changed.map((value, row) => actual === 0 ? 0 : (error[row] - value) / actual);
      });
      // Solve in constraint space (J Jᵀ + λI), keeping sparse rig degrees free.
      const matrix = error.map((_, row) => error.map((__, column) =>
        jacobian.reduce((sum, derivative) => sum + derivative[row] * derivative[column], 0) + (row === column ? (fingerOnly ? 1e-7 * (character.height / 1.8) ** 2 : .00001) : 0)));
      const multipliers = solveLinear(matrix, error);
      const delta = jacobian.map(column => column.reduce((sum, value, i) => sum + value * multipliers[i], 0));
      let accepted = false;
      for (const scale of [1, 0.5, 0.2, 0.05]) {
        variables.forEach((variable, i) => variable.set(base[i] + Math.max(-15, Math.min(15, delta[i])) * scale));
        if (energy(residual(targets)) < score - 1e-14) { accepted = true; break; }
      }
      if (!accepted) { variables.forEach((variable, i) => variable.set(base[i])); break; }
    }
  };
  optimize([...pins, desired], 65);
  if (pins.length) optimize(pins, 25);
  residual(pins);
  const final = worldNow();
  const validPins = pins.every(pin => (!pin.position || pin.position.distanceTo(final[pin.id].position) < 0.00001)
    && (!pin.rotation || pin.rotation.angleTo(final[pin.id].rotation) < 0.00001));
  if (!validPins) return isolated && !fingerOnly ? solveJoint(source,jointId,goal,false) : { character: source, constrained: true };
  const constrained = (desired.position ? desired.position.distanceTo(final[jointId].position) > (fingerOnly ? character.height * .0005 : .005) : false)
    || (desired.rotation ? desired.rotation.angleTo(final[jointId].rotation) > 0.005 : false);
  if (constrained && isolated && !fingerOnly) {
    const full = solveJoint(source,jointId,goal,false);
    const error = (actor: SpatialCharacter) => {
      const final = jointWorldTransforms(actor)[jointId];
      return (desired.position?.distanceTo(final.position) ?? 0) + (desired.rotation?.angleTo(final.rotation) ?? 0);
    };
    if (error(full.character) < error(character)) return full;
  }
  return { character, constrained };
}

function solveLinear(matrix: number[][], values: number[]): number[] {
  const rows = matrix.map((row, i) => [...row, values[i]]);
  const n = rows.length;
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[pivot], rows[column]] = [rows[column], rows[pivot]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-14) continue;
    for (let k = column; k <= n; k++) rows[column][k] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let k = column; k <= n; k++) rows[row][k] -= factor * rows[column][k];
    }
  }
  return rows.map(row => row[n]);
}
