import {
  BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial,
  LineSegments, OrthographicCamera, PerspectiveCamera, Quaternion, SphereGeometry, Vector3,
} from "three";
import { createCharacterModel } from "./model.ts";
import { jointWorldTransforms, quaternion, vector } from "./kinematics.ts";
import type { SpatialCamera, SpatialCharacter, SpatialDraft } from "./types.ts";
import { fingerPart } from "./hands.ts";

export function createOutputCamera(source: SpatialCamera) {
  const aspect = source.width / source.height;
  const camera = source.projection === "orthographic"
    ? new OrthographicCamera(-source.span * aspect / 2, source.span * aspect / 2, source.span / 2, -source.span / 2, 0.01, 30000)
    : new PerspectiveCamera(source.fov, aspect, 0.01, 30000);
  camera.position.copy(vector(source.position));
  camera.lookAt(vector(source.target));
  camera.updateMatrixWorld();
  return camera;
}

export function createSpatialScene(draft: SpatialDraft, options: { showRig?: boolean; handCreases?: boolean } = {}): Group {
  const scene = new Group();
  const add = (geometry: BoxGeometry | CylinderGeometry | SphereGeometry, color: string, position: Vector3, rotation: Quaternion, userData: Record<string, string>, scale = new Vector3(1, 1, 1)) => {
    const mesh = new Mesh(geometry, new MeshLambertMaterial({ color: new Color(color), side: DoubleSide }));
    mesh.position.copy(position); mesh.quaternion.copy(rotation); mesh.scale.copy(scale); mesh.userData = userData;
    scene.add(mesh);
    return mesh;
  };
  for (const actor of draft.characters) {
    scene.add(createCharacterModel(actor, options));
    if (!options.showRig || actor.appearance === "geometric") continue;
    updateSpatialRig(scene, actor);
  }
  for (const object of draft.objects) {
    const size = vector(object.size);
    const geometry = object.kind === "sphere" ? new SphereGeometry(0.5, 16, 12) : new BoxGeometry(1, 1, 1);
    if (object.kind === "plane") size.y = 0.015;
    add(geometry, object.color, vector(object.position), quaternion(object.rotation), { objectId: object.id }, size);
  }
  scene.updateMatrixWorld(true);
  return scene;
}

/** Unit helper geometry survives pose/proportion changes; only transforms change. */
export function updateSpatialRig(scene: Group, actor: SpatialCharacter, batch = false): void {
  const parts = spatialRigParts(actor);
  if (batch) {
    const matrix = new Matrix4();
    for (const rig of ["joint", "bone"] as const) {
      const instances = parts.filter(part => part.data.rig === rig);
      let mesh = scene.children.find(object => object instanceof InstancedMesh && object.userData.characterId === actor.id && object.userData.rig === rig) as InstancedMesh | undefined;
      if (mesh && mesh.count !== instances.length) { scene.remove(mesh); disposeSpatialScene(new Group().add(mesh)); mesh = undefined; }
      if (!mesh) {
        mesh = new InstancedMesh(rigGeometry(rig), new MeshLambertMaterial({ side: DoubleSide, depthTest: false }), instances.length);
        mesh.renderOrder = 2; scene.add(mesh);
      }
      mesh.userData = { characterId: actor.id, rig, instances: instances.map(part => part.data) };
      const color = new Color(rig === "joint" ? "#e6a65c" : "#728aa1");
      instances.forEach((part, i) => {
        mesh!.setMatrixAt(i, matrix.compose(part.position, part.rotation, part.scale)); mesh!.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return;
  }
  const existing = new Map(scene.children.filter(object => object.userData.rig && object.userData.characterId === actor.id)
    .map(object => [`${object.userData.rig}/${object.userData.jointId ?? object.userData.boneId}`, object as Mesh]));
  const add = (rig: "joint" | "bone", id: string) => {
    const key = `${rig}/${id}`;
    let mesh = existing.get(key); existing.delete(key);
    if (!mesh) {
      mesh = new Mesh(rigGeometry(rig), new MeshLambertMaterial({ side: DoubleSide, depthTest: false }));
      mesh.userData = { characterId: actor.id, rig, [rig === "joint" ? "jointId" : "boneId"]: id };
      mesh.renderOrder = 2; scene.add(mesh);
    }
    (mesh.material as MeshLambertMaterial).color.set(rig === "joint" ? "#e6a65c" : "#728aa1");
    return mesh;
  };
  for (const part of parts) {
    const mesh = add(part.data.rig, part.data.jointId ?? part.data.boneId!);
    mesh.position.copy(part.position); mesh.quaternion.copy(part.rotation); mesh.scale.copy(part.scale);
  }
  for (const mesh of existing.values()) {
    scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as MeshLambertMaterial).dispose();
  }
}

const rigGeometry = (rig: "joint" | "bone") => rig === "joint" ? new SphereGeometry(1,12,8) : new CylinderGeometry(1,1,1,10);
type RigPart = { data: { characterId: string; rig: "joint" | "bone"; jointId?: string; boneId?: string }; position: Vector3; rotation: Quaternion; scale: Vector3 };
function spatialRigParts(actor: SpatialCharacter): RigPart[] {
  const world = jointWorldTransforms(actor), parts: RigPart[] = [];
  for (const joint of actor.joints.filter(j => !j.terminal || Boolean(fingerPart(actor.bones.find(b => b.endJointId === j.id)?.modelPart ?? "")))) {
    parts.push({ data: { characterId: actor.id, rig: "joint", jointId: joint.id }, position: world[joint.id].position, rotation: world[joint.id].rotation, scale: new Vector3().setScalar(joint.radius) });
  }
  for (const bone of actor.bones) {
    const finger = fingerPart(bone.modelPart);
    if (finger?.segment === 0) continue;
    const start = world[bone.startJointId].position, end = world[bone.endJointId].position;
    const direction = end.clone().sub(start), length = direction.length(), radius = actor.height * (finger ? .0018 : .009);
    parts.push({ data: { characterId: actor.id, rig: "bone", boneId: bone.id }, position: start.clone().add(end).multiplyScalar(.5), rotation: new Quaternion().setFromUnitVectors(new Vector3(0,1,0), direction.normalize()), scale: new Vector3(radius,length,radius) });
  }
  return parts;
}

export function disposeSpatialScene(scene: Group): void {
  scene.traverse(object => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      if (object instanceof InstancedMesh) object.dispose();
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  });
}
