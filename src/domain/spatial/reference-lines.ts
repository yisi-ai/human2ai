import { BufferGeometry, Color, Float32BufferAttribute, LineBasicMaterial, LineSegments, Vector3 } from "three";
import { fingerPart, handRig } from "./hands.ts";
import type { SpatialCharacter, Vec3 } from "./types.ts";

/** Intersect finger joint planes with the skin in rest space, then interpolate
 * on the exact posed triangles. This follows both proportions and skinning,
 * including custom limbs, without floating rings or a second deformation path. */
export function createFingerCreases(actor: SpatialCharacter, modelPart: string, rest: number[], posed: number[], indices: number[]): LineSegments | null {
  const finger = fingerPart(modelPart);
  if (!finger) return null;
  const cuts = handRig(actor).parts.filter(part => {
    const other = fingerPart(part.id);
    // Omit the lowest crease at the palm: retain PIP/DIP, or only thumb IP.
    return other?.side === finger.side && other.finger === finger.finger && other.segment >= (finger.finger === "thumb" ? 3 : 2);
  });
  const lines: number[] = [];
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
      const crossings: { source: Vector3; point: Vector3 }[] = [];
      for (let j = 0; j < 3; j++) {
        const next = (j + 1) % 3;
        if ((distance[j] < 0) === (distance[next] < 0)) continue;
        const t = distance[j] / (distance[j] - distance[next]);
        crossings.push({ source: points[j].clone().lerp(points[next], t), point: new Vector3().fromArray(posed, ids[j] * 3).lerp(new Vector3().fromArray(posed, ids[next] * 3), t) });
      }
      if (crossings.length !== 2) continue;
      const [a, b] = crossings;
      const da = a.source.clone().sub(origin).dot(fold), db = b.source.clone().sub(origin).dot(fold);
      if (da <= 0 && db <= 0) continue;
      if (da < 0) a.point.lerp(b.point, da / (da - db));
      else if (db < 0) b.point.lerp(a.point, db / (db - da));
      lines.push(...a.point.toArray(), ...b.point.toArray());
    }
  }
  if (!lines.length) return null;
  const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(lines, 3));
  const creases = new LineSegments(geometry, new LineBasicMaterial({ color: new Color(actor.color).multiplyScalar(.1), depthWrite: false }));
  creases.renderOrder = 1;
  // Decorative skin detail must not intercept joint or body-part selection.
  creases.raycast = () => {};
  return creases;
}
