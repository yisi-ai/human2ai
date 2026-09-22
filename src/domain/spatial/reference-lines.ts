import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, Vector3 } from "three";
import { fingerPart, handRig } from "./hands.ts";
import type { SpatialCharacter, Vec3 } from "./types.ts";

type Crossing = [number, number, number];
export interface FingerCreaseSegment { a: Crossing; b: Crossing; trimA?: number; trimB?: number }

/** Rest-space intersections only change with the source anatomy and head morph. */
export function fingerCreaseSegments(actor: SpatialCharacter, modelPart: string, rest: ArrayLike<number>, indices: number[]): FingerCreaseSegment[] {
  const finger = fingerPart(modelPart);
  if (!finger) return [];
  const cuts = handRig(actor).parts.filter(part => {
    const other = fingerPart(part.id);
    // Omit the lowest crease at the palm: retain PIP/DIP, or only thumb IP.
    return other?.side === finger.side && other.finger === finger.finger && other.segment >= (finger.finger === "thumb" ? 3 : 2);
  });
  const segments: FingerCreaseSegment[] = [];
  for (const cut of cuts) {
    const origin = new Vector3(...cut.start as Vec3);
    const axis = new Vector3(...cut.end as Vec3).sub(origin).normalize();
    // This is local Z in fingerBasis. Four fingers curl toward Z around X;
    // thumb IP curls around mirrored Z, so its inner crease faces +/- X.
    const fold = new Vector3(0, -1, 0).addScaledVector(axis, axis.y).normalize();
    if (finger.finger === "thumb") fold.cross(axis).multiplyScalar(finger.side === "left" ? -1 : 1);
    for (let i = 0; i < indices.length; i += 3) {
      const ids = indices.slice(i, i + 3);
      const points = ids.map(id => new Vector3().fromArray(rest, id * 3));
      const distance = points.map(point => point.clone().sub(origin).dot(axis));
      const crossings: { source: Vector3; edge: Crossing }[] = [];
      for (let j = 0; j < 3; j++) {
        const next = (j + 1) % 3;
        if ((distance[j] < 0) === (distance[next] < 0)) continue;
        const t = distance[j] / (distance[j] - distance[next]);
        crossings.push({ source: points[j].clone().lerp(points[next], t), edge: [ids[j], ids[next], t] });
      }
      if (crossings.length !== 2) continue;
      const [a, b] = crossings;
      const da = a.source.clone().sub(origin).dot(fold), db = b.source.clone().sub(origin).dot(fold);
      if (da <= 0 && db <= 0) continue;
      segments.push({ a: a.edge, b: b.edge, ...(da < 0 ? { trimA: da / (da - db) } : db < 0 ? { trimB: db / (db - da) } : {}) });
    }
  }
  return segments;
}

/** Interpolate the same posed triangles, retaining GPU buffers across gestures. */
export function updateFingerCreases(actor: SpatialCharacter, segments: FingerCreaseSegment[], posed: ArrayLike<number>, retained?: LineSegments): LineSegments | null {
  if (!segments.length) return null;
  const creases = retained ?? new LineSegments(new BufferGeometry(), new LineBasicMaterial({ depthWrite: false }));
  const geometry = creases.geometry;
  if (geometry.getAttribute("position")?.count !== segments.length * 2) {
    // Dispose the old GPU buffer if a new head morph changes the line topology.
    geometry.dispose(); geometry.setAttribute("position", new Float32BufferAttribute(segments.length * 6, 3));
  }
  const positions = geometry.getAttribute("position"), a = new Vector3(), b = new Vector3(), end = new Vector3();
  segments.forEach((segment, i) => {
    a.fromArray(posed, segment.a[0] * 3).lerp(end.fromArray(posed, segment.a[1] * 3), segment.a[2]);
    b.fromArray(posed, segment.b[0] * 3).lerp(end.fromArray(posed, segment.b[1] * 3), segment.b[2]);
    if (segment.trimA !== undefined) a.lerp(b, segment.trimA);
    else if (segment.trimB !== undefined) b.lerp(a, segment.trimB);
    positions.setXYZ(i*2,a.x,a.y,a.z); positions.setXYZ(i*2+1,b.x,b.y,b.z);
  });
  positions.needsUpdate = true; geometry.boundingBox = null; geometry.boundingSphere = null;
  (creases.material as LineBasicMaterial).color.set(actor.color).multiplyScalar(.1);
  creases.renderOrder = 1;
  // Decorative skin detail must not intercept joint or body-part selection.
  creases.raycast = () => {};
  return creases;
}

export function createFingerCreases(actor: SpatialCharacter, modelPart: string, rest: number[], posed: number[], indices: number[]): LineSegments | null {
  return updateFingerCreases(actor, fingerCreaseSegments(actor, modelPart, rest, indices), posed);
}
