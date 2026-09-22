import { BufferAttribute, Color, Group, LineSegments, Matrix4, Mesh, MeshLambertMaterial, Object3D, Vector3 } from "three";
import { quaternion, vector } from "./kinematics.ts";
import type { SpatialCharacter, SpatialObject } from "./types.ts";

export const entityMatrix = (entity: SpatialCharacter | SpatialObject) => new Matrix4().compose(vector(entity.position), quaternion(entity.rotation), new Vector3(1,1,1));
type Drawable = Mesh | LineSegments;
const drawable = (object: Object3D): object is Drawable => object instanceof Mesh || object instanceof LineSegments;

/** Preserve GPU buffers and picking identity when authored topology stays the same. */
export function updateSpatialGeometry(target: Group, source: Group): boolean {
  const before: Object3D[] = [], after: Object3D[] = [];
  target.traverse(object => before.push(object)); source.traverse(object => after.push(object));
  if (before.length !== after.length || before.some((object, i) => {
    const next = after[i];
    if (object.type !== next.type || JSON.stringify(object.userData) !== JSON.stringify(next.userData)) return true;
    if (!drawable(object) || !drawable(next)) return false;
    return object.geometry.getAttribute("position").count !== next.geometry.getAttribute("position").count
      || object.geometry.index?.count !== next.geometry.index?.count
      || Object.entries(next.geometry.attributes).some(([name, attribute]) => object.geometry.getAttribute(name)?.array.length !== attribute.array.length);
  })) return false;
  before.forEach((object, i) => {
    const next = after[i];
    object.position.copy(next.position); object.quaternion.copy(next.quaternion); object.scale.copy(next.scale);
    object.matrixAutoUpdate = next.matrixAutoUpdate; object.matrix.copy(next.matrix);
    if (!drawable(object) || !drawable(next)) return;
    for (const [name, attribute] of Object.entries(next.geometry.attributes)) {
      const previous = object.geometry.getAttribute(name) as BufferAttribute;
      previous.array.set(attribute.array); previous.needsUpdate = true;
    }
    if (object.geometry.index && next.geometry.index) {
      object.geometry.index.array.set(next.geometry.index.array); object.geometry.index.needsUpdate = true;
    }
    object.geometry.boundingBox = null; object.geometry.boundingSphere = null;
    if (!Array.isArray(object.material) && !Array.isArray(next.material)) object.material.copy(next.material);
  });
  return true;
}

export function rememberSpatialColors(group: Group, colors: WeakMap<Mesh, Color>): void {
  group.traverse(object => {
    if (object instanceof Mesh && object.material instanceof MeshLambertMaterial) colors.set(object, object.material.color.clone());
  });
}
