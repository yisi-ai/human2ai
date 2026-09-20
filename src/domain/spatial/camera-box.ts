import { Box3, Mesh, OrthographicCamera, Vector3 } from "three";
import { quaternion, vector } from "./kinematics.ts";
import { fingerPart } from "./hands.ts";
import { createSpatialScene, disposeSpatialScene } from "./scene.ts";
import { SPATIAL_BOX_FACES, type SpatialBoxFace, type SpatialBoxView, type SpatialCamera, type SpatialCameraBox, type SpatialDraft, type Vec3 } from "./types.ts";
import { cameraBoxSheetLayout } from "./camera-box-sheet.ts";

// All directions are box-local. Top and bottom have explicit, non-degenerate up axes.
const axes: Record<SpatialBoxFace, { normal: Vec3; up: Vec3 }> = {
  front: { normal: [0,0,1], up: [0,1,0] }, back: { normal: [0,0,-1], up: [0,1,0] },
  left: { normal: [-1,0,0], up: [0,1,0] }, right: { normal: [1,0,0], up: [0,1,0] },
  top: { normal: [0,1,0], up: [0,0,-1] }, bottom: { normal: [0,-1,0], up: [0,0,1] },
};
export function createSpatialCameraBox(id: string, name: string): SpatialCameraBox {
  return { id, name, position: [0, .9, 0], rotation: [0,0,0], size: 2.4, resolution: 512 };
}
export function cameraBoxImageSize(box: SpatialCameraBox, view: SpatialBoxView | readonly SpatialBoxFace[]) {
  if (typeof view === "string" && view !== "sheet") return { width: box.resolution, height: box.resolution };
  const { width, height } = cameraBoxSheetLayout(box.resolution, typeof view === "string" ? SPATIAL_BOX_FACES : view);
  return { width, height };
}
export function cameraBoxView(box: SpatialCameraBox, face: SpatialBoxFace): { source: SpatialCamera; camera: OrthographicCamera } {
  const rotation = quaternion(box.rotation), half = box.size / 2;
  const position = vector(axes[face].normal).applyQuaternion(rotation).multiplyScalar(half).add(vector(box.position));
  const camera = new OrthographicCamera(-half, half, half, -half, 0, box.size);
  camera.position.copy(position);
  camera.up.copy(vector(axes[face].up).applyQuaternion(rotation));
  camera.lookAt(vector(box.position)); camera.updateMatrixWorld();
  const source: SpatialCamera = { id: `${box.id}-${face}`, name: box.name, position: position.toArray() as Vec3, target: [...box.position], projection: "orthographic", fov: 40, span: box.size, width: box.resolution, height: box.resolution, background: null };
  return { source, camera };
}
/** Fit real posed mesh vertices in the box's own axes, including custom creature hands. */
export function fitSpatialCameraBox(box: SpatialCameraBox, draft: SpatialDraft, region: "scene" | "hands"): SpatialCameraBox {
  const scene = createSpatialScene(draft), bounds = new Box3(), inverse = quaternion(box.rotation).invert(), point = new Vector3();
  try {
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const part = String(object.userData.modelPart ?? "");
      if (region === "hands" && !part.endsWith("-hand") && !fingerPart(part)) return;
      const vertices = object.geometry.getAttribute("position");
      for (let i = 0; i < vertices.count; i++) bounds.expandByPoint(point.fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld).applyQuaternion(inverse));
    });
  } finally { disposeSpatialScene(scene); }
  if (bounds.isEmpty()) return box;
  const size = bounds.getSize(new Vector3());
  return { ...box, position: bounds.getCenter(new Vector3()).applyQuaternion(quaternion(box.rotation)).toArray() as Vec3, size: Math.max(.05, Math.max(size.x,size.y,size.z) * 1.15) };
}
