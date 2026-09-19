import { Box3, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Group, Matrix4, Mesh, MeshLambertMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { fingerPart, handRestMatrix, handRig, type SpatialFinger } from "./hands.ts";
import { jointWorldTransforms, proportionedJointOffset, vector } from "./kinematics.ts";
import { footHeightScale, partWidth, spatialShape } from "./proportions.ts";
import type { SpatialCharacter, Vec3 } from "./types.ts";

// Match anatomical digits across both hands and cloned limbs.
const fingerColors: Record<SpatialFinger,string> = {
  thumb:"#e49a45", index:"#499dd6", middle:"#45ad86", ring:"#a47bd4", little:"#dd6f8f",
};

/** Rigid primitives share the authored rig with the anatomical surface. */
export function createGeometricCharacterModel(actor: SpatialCharacter): Group {
  const group = new Group(), world = jointWorldTransforms(actor), shape = spatialShape(actor.headRatio);
  const up = new Vector3(0,1,0), bodyColor = new Color(actor.color);
  const bodyLuminance = .2126*bodyColor.r + .7152*bodyColor.g + .0722*bodyColor.b;
  const jointColor = bodyColor.clone().lerp(new Color(bodyLuminance > .25 ? "#26384b" : "#dce5ef"),.75);
  const radii = new Map(actor.bones.map(bone => {
    const part = bone.modelPart, finger = fingerPart(part);
    const factor = ["spine","chest"].includes(part) ? .035 : part === "neck" ? .014
      : /-(shoulder|hip)$/.test(part) ? .012 : part.endsWith("-wrist") ? .014
      : part.endsWith("-elbow") ? .016 : part.endsWith("-knee") ? .022 : .019;
    const radius = finger ? actor.height * .0033 * shape.hand * (actor.palmSize ?? 1) * (finger.finger === "little" ? .8 : 1)
      : actor.height * factor * partWidth(shape,part);
    const length = world[bone.startJointId].position.distanceTo(world[bone.endJointId].position);
    return [bone.id, finger && finger.segment > 0 ? Math.min(radius,length*.35) : radius];
  }));
  const add = (geometry: BufferGeometry, position: Vector3, rotation: Quaternion, data: Record<string,string>, color = bodyColor) => {
    const mesh = new Mesh(geometry,new MeshLambertMaterial({color}));
    mesh.position.copy(position); mesh.quaternion.copy(rotation);
    mesh.userData = {characterId:actor.id,...data}; group.add(mesh); return mesh;
  };
  for (const bone of actor.bones) {
    const start = world[bone.startJointId].position, end = world[bone.endJointId].position;
    const offset = proportionedJointOffset(actor,actor.joints.find(j=>j.id===bone.endJointId)!);
    const rotation = world[bone.endJointId].rotation;
    const direction = end.clone().sub(start), length = direction.length();
    const center = start.clone().add(end).multiplyScalar(.5);
    const aligned = rotation.clone().multiply(new Quaternion().setFromUnitVectors(up,offset.clone().normalize()));
    const data = {boneId:bone.id,modelPart:bone.modelPart};
    if (bone.modelPart === "head") {
      const rx = length*.36, ry = length*.5, rz = length*.31*shape.headDepth;
      add(new SphereGeometry(1,24,16).scale(rx,ry,rz),center,aligned,data);
      for (const side of [-1,1]) {
        const eye = new Vector3(side*rx*.34,ry*.12,rz*.94).applyQuaternion(aligned).add(center);
        add(new SphereGeometry(1,12,8).scale(rx*.105,ry*.095,rz*.065),eye,aligned,{...data,feature:"eye"},new Color("#23313c"));
      }
    } else if (bone.modelPart.endsWith("-hand")) {
      // Fit a rigid palm to the wrist and fixed knuckles. Its frame follows
      // wrist rotation, including twist; curled fingers cannot resize it.
      const normal = new Vector3(0,1,0).transformDirection(handRestMatrix(actor,bone)).applyQuaternion(rotation);
      const y = direction.clone().normalize(), x = y.clone().cross(normal).normalize(), z = x.clone().cross(y).normalize();
      const frame = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
      const inverse = frame.clone().invert(), bounds = new Box3().expandByPoint(new Vector3()).expandByPoint(direction.clone().applyQuaternion(inverse));
      for (const root of actor.bones.filter(b=>b.startJointId===bone.endJointId && fingerPart(b.modelPart)?.segment===0 && fingerPart(b.modelPart)?.finger!=="thumb")) {
        bounds.expandByPoint(world[root.endJointId].position.clone().sub(start).applyQuaternion(inverse));
      }
      const thickness = actor.height*.018*shape.hand*(actor.palmSize ?? 1);
      bounds.min.x -= thickness*.2; bounds.max.x += thickness*.2; bounds.min.y -= thickness*.25;
      const size = bounds.getSize(new Vector3()); size.z = Math.max(size.z,thickness);
      const palmCenter = bounds.getCenter(new Vector3()).applyQuaternion(frame).add(start);
      add(new BoxGeometry(size.x,size.y,size.z),palmCenter,frame,data);
    } else if (bone.modelPart.endsWith("-foot")) {
      // Use the same anatomical sole height as ankle lifting. The box remains
      // flat in the rest pose and rotates as a whole about the ankle.
      const rig = handRig(actor), source = rig.parts.find(p=>p.id===bone.modelPart)!;
      const base = vector(actor.joints.find(j=>j.id===bone.endJointId)!.offset).length()/vector(source.end as Vec3).sub(vector(source.start as Vec3)).length();
      const sole = (source.start[1]-rig.bottom)*base*footHeightScale(actor.footSize);
      const width = actor.height*.055*shape.foot*(actor.footSize ?? 1), heel = width*.45;
      const top = actor.height*.006*footHeightScale(actor.footSize);
      const footCenter = new Vector3(offset.x/2,(top-sole)/2,(offset.z-heel)/2).applyQuaternion(rotation).add(start);
      add(new BoxGeometry(width,sole+top,Math.abs(offset.z)+heel),footCenter,rotation,data);
    } else {
      const radius = radii.get(bone.id)!;
      const finger = fingerPart(bone.modelPart);
      add(new CylinderGeometry(radius,radius,length,12),center,new Quaternion().setFromUnitVectors(up,direction.normalize()),data,finger ? new Color(fingerColors[finger.finger]) : bodyColor);
    }
  }
  for (const joint of actor.joints) {
    const incoming = actor.bones.find(b=>b.endJointId===joint.id), part = incoming?.modelPart ?? "pelvis";
    // Head-top and toe landmarks are inside their solid forms, not hinges.
    if (joint.terminal && (part === "head" || part.endsWith("-foot"))) continue;
    const finger = fingerPart(part);
    const connected = actor.bones.filter(b=>b.endJointId===joint.id || b.startJointId===joint.id);
    const radius = finger ? Math.max(...connected.map(b=>radii.get(b.id)!)) * 1.08
      : part === "neck" ? actor.height*.016
      : Math.max(actor.height*.009,...connected.filter(b=>b.modelPart!=="head" && !b.modelPart.endsWith("-hand") && !b.modelPart.endsWith("-foot")).map(b=>radii.get(b.id)!))*1.14;
    const color = finger ? new Color(fingerColors[finger.finger]).lerp(new Color("#ffffff"),.65) : jointColor;
    add(new SphereGeometry(radius,16,10),world[joint.id].position,world[joint.id].rotation,{jointId:joint.id,modelPart:part},color);
  }
  group.updateMatrixWorld(true);
  return group;
}
