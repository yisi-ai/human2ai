/** Rest-shape references, independent of pose and the authored torso/leg split. */
const references = [
  { heads: 2, softness: 1, torso: 1.02, torsoDepth: 1.5, headDepth: .9, shoulder: .94, hip: 1, arm: 1.02, forearm: 1.08, thigh: 1, calf: 1.12, hand: 1.35, foot: 1.5, armLength: .84, handLength: 1.2, footLength: 1.75, neck: .42 },
  { heads: 3, softness: .82, torso: .94, torsoDepth: 1.24, headDepth: .94, shoulder: .87, hip: .88, arm: .94, forearm: .96, thigh: .94, calf: 1, hand: 1.18, foot: 1.26, armLength: .92, handLength: 1.12, footLength: 1.45, neck: .55 },
  { heads: 4, softness: .5, torso: .84, torsoDepth: 1, headDepth: .94, shoulder: .84, hip: .84, arm: .75, forearm: .78, thigh: .84, calf: .80, hand: .88, foot: .94, armLength: .98, handLength: 1.04, footLength: 1.08, neck: .72 },
  { heads: 7, softness: 0, torso: 1, torsoDepth: 1, headDepth: 1, shoulder: 1, hip: 1, arm: 1, forearm: 1, thigh: 1, calf: 1, hand: 1, foot: 1, armLength: 1, handLength: 1, footLength: 1, neck: 1 },
];
export type SpatialShape = typeof references[number];

/** Foot thickness follows half the width/length change. */
export const footHeightScale = (size = 1) => 1 + (size - 1) * .5;

/** The same adjacent targets and easing drive both rig dimensions and vertices. */
export function spatialReferenceBlend(headRatio: number): [number, number, number] {
  const upper = references.findIndex(reference => reference.heads >= headRatio);
  if (upper === 0) return [0, 0, 0];
  if (upper === -1) return [3, 3, 0];
  const t = (headRatio - references[upper - 1].heads) / (references[upper].heads - references[upper - 1].heads);
  return [upper - 1, upper, t * t * (3 - 2 * t)];
}

export function spatialShape(headRatio: number): SpatialShape {
  if (headRatio > 7) {
    const shape = { ...references[3] }, width = Math.sqrt(7 / headRatio);
    for (const key of ["torso", "torsoDepth", "shoulder", "hip", "arm", "forearm", "thigh", "calf", "hand", "foot"] as const) shape[key] = width;
    return shape;
  }
  const [lower, upper, blend] = spatialReferenceBlend(headRatio);
  const a = references[lower], b = references[upper];
  return Object.fromEntries(Object.keys(a).map(key => {
    const field = key as keyof SpatialShape;
    return [field, a[field] + (b[field] - a[field]) * blend];
  })) as SpatialShape;
}

export function partWidth(shape: SpatialShape, part: string): number {
  if (part.endsWith("-shoulder")) return shape.shoulder;
  if (part.endsWith("-hip")) return shape.hip;
  if (part.endsWith("-elbow")) return shape.arm;
  if (part.endsWith("-wrist")) return shape.forearm;
  if (part.endsWith("-hand")) return shape.hand;
  if (part.endsWith("-knee")) return shape.thigh;
  if (part.endsWith("-ankle")) return shape.calf;
  if (part.endsWith("-foot")) return shape.foot;
  return shape.torso;
}
export const BODY_SHAPE_LIMITS = {
  neckLength: { min: .6, max: 1.4 },
  palmSize: { min: .7, max: 1.3 },
  fingerLength: { min: .6, max: 1.4 },
  footSize: { min: .7, max: 1.4 },
} as const;
