import type maleAsset from "./assets/quaternius-superhero.json";
import { isHandPart } from "./hands.ts";

/** Weld rest-space seams before relaxing a target, including between modules. */
function relax(asset: typeof maleAsset, target: number[], passes: number, preserveVolume: boolean): number[] {
  const groups: number[][] = [], at: number[] = [], byPosition = new Map<string,number>();
  for (let v = 0; v < target.length / 3; v++) {
    const key = asset.positions.slice(v*3,v*3+3).join(",");
    let group = byPosition.get(key);
    if (group === undefined) { group = groups.length; byPosition.set(key,group); groups.push([]); }
    groups[group].push(v); at.push(group);
  }
  const adjacent = groups.map(() => new Set<number>());
  for (const module of asset.modules.filter(m => m.material === "body")) for (let i = 0; i < module.indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = at[module.indices[i+j]], b = at[module.indices[i+(j+1)%3]];
    if (a !== b) { adjacent[a].add(b); adjacent[b].add(a); }
  }
  let positions = groups.map(vertices => target.slice(vertices[0]*3,vertices[0]*3+3));
  for (let pass = 0; pass < passes; pass++) positions = positions.map((point,i) => {
    const neighbors = [...adjacent[i]], amount = preserveVolume && pass % 2 ? -.53 : .5;
    return neighbors.length ? point.map((v,axis) => v + amount * (neighbors.reduce((sum,j) => sum + positions[j][axis],0) / neighbors.length - v)) : point;
  });
  return target.map((_,i) => positions[at[Math.floor(i/3)]][i%3]);
}

/** The existing four-head reference retains a little more anatomical detail. */
function createSoftTarget(asset: typeof maleAsset): number[] {
  const original = asset.positions, smoothed = relax(asset,original,18,false);
  const head = asset.parts.find(p => p.id === "head")!;
  const headVertices = asset.modules.filter(m => asset.parts[m.part].id === "head").flatMap(m => m.indices);
  const chin = Math.min(...headVertices.map(vertex => original[vertex * 3 + 1]));
  const pelvis = asset.parts.find(p => p.id === "pelvis")!, chest = asset.parts.find(p => p.id === "chest")!;
  return original.map((value, index) => {
    const vertex = Math.floor(index / 3), axis = index % 3;
    const x = original[vertex * 3], y = original[vertex * 3 + 1], z = original[vertex * 3 + 2];
    const headHeight = head.end[1] - head.start[1], t = (y - chin) / (head.end[1] - chin);
    if (t >= 0) {
      // Map chin-to-crown to the head reference; retain a rounded lower face.
      const face = Math.min(1, t);
      if (axis === 0) return x * (1.12 + .14 * Math.sin(Math.PI * face));
      if (axis === 1) return head.start[1] + headHeight * (face - .06 * Math.sin(Math.PI * face));
      const front = z - head.start[2];
      return head.start[2] + (front > .035 ? .035 + (front - .035) * .6 : front * .88);
    }
    // Muscle smoothing collapses the narrow finger cross-sections in X/Z
    // while Y stays anatomical. Preserve hand volume, blending at the wrist
    // with the existing skin weights; chibi targets still get 3D relaxation.
    let handWeight = 0;
    for (let k = 0; k < 4; k++) if (isHandPart(asset.parts[asset.influences[vertex*4+k]].id)) handWeight += asset.weights[vertex*4+k];
    const smooth = smoothed[index] + (value - smoothed[index]) * handWeight;
    const upper = Math.max(0, Math.min(1, (y - pelvis.start[1]) / (chest.end[1] - pelvis.start[1])));
    const central = Math.max(0, Math.min(1, (.28 - Math.abs(x)) / .12));
    if (axis === 0) return smooth * (1 + .18 * central * Math.sin(Math.PI * upper));
    if (axis === 2) return smooth * (1 - .36 * central * upper);
    // Blend the chin lift down through the neck, without separating its skin.
    const neck = Math.max(0, Math.min(1, (y - chest.end[1]) / (chin - chest.end[1])));
    return value + (head.start[1] - chin) * neck * central;
  });
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
// Authored cross-sections: each target has its own cheek, jaw and torso contour.
// Values are interpolated in rest space, before any bone rotation or cloning.
function profile(points: number[][], t: number): number[] {
  const upper = points.findIndex(point => point[0] >= t);
  if (upper <= 0) return (upper === 0 ? points[0] : points[points.length - 1]).slice(1);
  const a = points[upper - 1], b = points[upper], before = points[Math.max(0,upper - 2)], after = points[Math.min(points.length - 1,upper + 1)];
  const u = (t - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, i) => {
    const m0 = (b[i + 1] - before[i + 1]) / (b[0] - before[0]) * (b[0] - a[0]);
    const m1 = (after[i + 1] - v) / (after[0] - a[0]) * (b[0] - a[0]);
    return (2*u*u*u - 3*u*u + 1)*v + (u*u*u - 2*u*u + u)*m0 + (-2*u*u*u + 3*u*u)*b[i + 1] + (u*u*u - u*u)*m1;
  });
}

function createChibiTarget(asset: typeof maleAsset, soft: number[], heads: 2 | 3): number[] {
  const original = asset.positions, target = [...soft];
  const head = asset.parts.find(p => p.id === "head")!, chest = asset.parts.find(p => p.id === "chest")!, pelvis = asset.parts[0];
  const headVertices = asset.modules.filter(m => asset.parts[m.part].id === "head").flatMap(m => m.indices);
  const chin = Math.min(...headVertices.map(v => original[v * 3 + 1])), height = head.end[1] - head.start[1];
  const eyes = [...new Set(asset.modules.filter(m => m.material === "eyes").flatMap(m => m.indices))].filter(v => original[v*3] > 0);
  const eyeX = eyes.reduce((sum,v) => sum + original[v*3],0) / eyes.length;
  const eyeY = eyes.reduce((sum,v) => sum + original[v*3+1],0) / eyes.length;
  const face = heads === 2
    ? [[0,.18,.22],[.12,.34,.34],[.3,.45,.41],[.52,.48,.44],[.72,.46,.43],[.9,.34,.33],[1,.13,.14]]
    : [[0,.14,.19],[.12,.29,.31],[.3,.41,.39],[.52,.45,.43],[.72,.43,.42],[.9,.32,.32],[1,.12,.13]];
  const torso = heads === 2
    ? [[0,.19,.105],[.3,.205,.115],[.65,.20,.11],[1,.18,.10]]
    : [[0,.18,.105],[.3,.172,.10],[.65,.19,.11],[1,.175,.095]];
  for (let vertex = 0; vertex < original.length / 3; vertex++) {
    const index = vertex * 3, [x,y,z] = original.slice(index,index + 3);
    if (y >= chin) {
      let t = clamp((y - chin) / (head.end[1] - chin));
      // Open the eyelids and eyeballs together, rather than enlarging an eye
      // behind the unchanged adult socket. The smooth cage keeps the lid joined.
      const eye = Math.exp(-(((Math.abs(x)-eyeX)/.03)**2 + ((y-eyeY)/.055)**2)) * ease((z-head.start[2])/.06) * (1-ease((t-.8)/.2));
      t += (y-eyeY) / (head.end[1]-chin) * eye * (heads === 2 ? 1.35 : 1.1);
      // Compress the adult lower face; keep eye level below the head midpoint.
      const vertical = t - (heads === 2 ? .10 : .065) * Math.sin(Math.PI * t);
      const [rx,rz] = profile(face,vertical);
      const dz = z - head.start[2], radius = Math.hypot(x, dz);
      const nx = radius > 1e-8 ? x / radius : 0, nz = radius > 1e-8 ? dz / radius : 0;
      const strength = ease(t / .08) * (heads === 2 ? .94 : .86);
      target[index] = soft[index] + (nx * rx * height - soft[index]) * strength;
      target[index + 1] = head.start[1] + height * vertical;
      target[index + 2] = soft[index + 2] + (head.start[2] + nz * rz * height - soft[index + 2]) * strength;
      continue;
    }
    const point = soft.slice(index,index + 3);
    // A single rounded chest/abdomen replaces adult chest, waist and glute relief.
    const t = clamp((y - pelvis.start[1]) / (chest.end[1] - pelvis.start[1]));
    const core = ease((.27 - Math.abs(x)) / .10) * ease((y - pelvis.start[1] + .04) / .12) * (1 - ease((y - chest.end[1] + .01) / .09));
    const centerZ = y < pelvis.end[1]
      ? pelvis.start[2] + (pelvis.end[2] - pelvis.start[2]) * clamp((y - pelvis.start[1]) / (pelvis.end[1] - pelvis.start[1]))
      : chest.start[2] + (chest.end[2] - chest.start[2]) * clamp((y - chest.start[1]) / (chest.end[1] - chest.start[1]));
    const radius = Math.hypot(point[0], point[2] - centerZ), [rx,rz] = profile(torso,t);
    if (radius > 1e-8) {
      target[index] += (point[0] / radius * rx - point[0]) * core;
      target[index + 2] += (centerZ + (point[2] - centerZ) / radius * rz - point[2]) * core;
    }
    // Fill the narrow elbows and wrists into simple soft tubes.
    // Skin weights blend neighboring sections and keep module seams identical.
    for (let k = 0; k < 4; k++) {
      const weight = asset.weights[vertex * 4 + k], part = asset.parts[asset.influences[vertex * 4 + k]];
      if (!weight || !/-(elbow|wrist)$/.test(part.id)) continue;
      const direction = part.end.map((v,i) => v - part.start[i]), length2 = direction.reduce((sum,v) => sum + v*v,0);
      const along = point.reduce((sum,v,i) => sum + (v - part.start[i])*direction[i],0) / length2;
      const center = part.start.map((v,i) => v + direction[i]*along), radial = point.map((v,i) => v - center[i]);
      const length = Math.hypot(...radial);
      if (length < 1e-8) continue;
      const r = part.id.endsWith("-elbow") ? .054 : .046;
      const rounded = r * (1 - .14 * ease(along));
      for (let axis = 0; axis < 3; axis++) target[index + axis] += radial[axis] * (rounded / length - 1) * weight * .8;
    }
    const side = x >= 0 ? "left" : "right";
    const thigh = asset.parts.find(p => p.id === `${side}-knee`)!, calf = asset.parts.find(p => p.id === `${side}-ankle`)!;
    if (y < thigh.start[1] && y > calf.end[1]) {
      // One continuous contour across the knee prevents two differently sized
      // bone sections from introducing a cuff where their weights meet.
      const leg = y > thigh.end[1] ? thigh : calf;
      const along = clamp((y - leg.start[1]) / (leg.end[1] - leg.start[1]));
      const cx = leg.start[0] + (leg.end[0] - leg.start[0])*along, cz = leg.start[2] + (leg.end[2] - leg.start[2])*along;
      const dx = point[0] - cx, dz = point[2] - cz, length = Math.hypot(dx,dz);
      const t = (y - calf.end[1]) / (thigh.start[1] - calf.end[1]);
      const [radius] = profile([[0,.045],[.2,.059],[.5,.063],[.8,.077],[1,.085]],t);
      const amount = ease(t / .12) * (1 - ease((t - .8) / .2)) * .92;
      if (length > 1e-8) {
        target[index] += dx * (radius / length - 1) * amount;
        target[index + 2] += dz * (radius / length - 1) * amount;
      }
    }
  }
  // Relax the sculpted cage in all three axes. Keeping the old adult Y values
  // after changing cross-sections would leave compressed folds at joints.
  const relaxed = relax(asset,target,24,true);
  for (let v = 0; v < original.length / 3; v++) {
    const y = original[v*3+1];
    // Keep the exact crown, chin seam and sole references stable.
    const amount = ease((y - .04) / .08) * (1 - ease((y - head.end[1] + .025) / .025));
    for (let axis = 0; axis < 3; axis++) target[v*3+axis] += (relaxed[v*3+axis] - target[v*3+axis]) * amount;
  }
  return target;
}

/** Four matching-topology vertex targets, built once for each source body. */
export function createMorphTargets(asset: typeof maleAsset): number[][] {
  const soft = createSoftTarget(asset);
  return [createChibiTarget(asset,soft,2), createChibiTarget(asset,soft,3), asset.positions.map((v,i) => v + (soft[i] - v) * .5), asset.positions];
}
