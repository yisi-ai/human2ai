import {
  BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshLambertMaterial,
  LineSegments, OrthographicCamera, PerspectiveCamera, Quaternion, SphereGeometry, Vector3,
} from "three";
import { createCharacterModel } from "./model.ts";
import { jointWorldTransforms, quaternion, vector } from "./kinematics.ts";
import type { SpatialCamera, SpatialDraft } from "./types.ts";
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
    const world = jointWorldTransforms(actor);
    const overlay = (mesh: Mesh) => {
      (mesh.material as MeshLambertMaterial).depthTest = false; mesh.renderOrder = 2;
    };
    for (const joint of actor.joints.filter(j=>!j.terminal || Boolean(fingerPart(actor.bones.find(b => b.endJointId === j.id)?.modelPart ?? "")))) {
      overlay(add(new SphereGeometry(joint.radius,12,8), "#e6a65c", world[joint.id].position, world[joint.id].rotation, { characterId:actor.id, jointId:joint.id, rig:"joint" }));
    }
    for (const bone of actor.bones) {
      const finger = fingerPart(bone.modelPart);
      if (finger?.segment === 0) continue;
      const start = world[bone.startJointId].position, end = world[bone.endJointId].position;
      const direction = end.clone().sub(start), length = direction.length();
      const data = { characterId:actor.id, boneId:bone.id, rig:"bone" };
      const radius = actor.height * (finger ? .0018 : .009);
      const mesh = add(new CylinderGeometry(radius,radius,length,10), "#728aa1", start.clone().add(end).multiplyScalar(.5), new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.normalize()),data);
      overlay(mesh);
    }
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

export function disposeSpatialScene(scene: Group): void {
  scene.traverse(object => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  });
}
