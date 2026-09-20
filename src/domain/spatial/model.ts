import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshLambertMaterial, Quaternion, Vector3 } from "three";
import maleAsset from "./assets/quaternius-superhero.json" with { type: "json" };
import femaleAsset from "./assets/quaternius-superhero-female.json" with { type: "json" };
import { jointWorldTransforms, proportionedJointOffset, quaternion, vector } from "./kinematics.ts";
import { footHeightScale, partWidth, spatialReferenceBlend, spatialShape } from "./proportions.ts";
import { createMorphTargets } from "./morph.ts";
import { fingerPart, fingerRestMatrix, owningHand } from "./hands.ts";
import { createFingerCreases } from "./reference-lines.ts";
import { createGeometricCharacterModel } from "./geometric-model.ts";
import type { SpatialBone, SpatialCharacter, Vec3 } from "./types.ts";

const up = new Vector3(0, 1, 0);
const sources = Object.fromEntries(Object.entries({ male: maleAsset, female: femaleAsset }).map(([bodyType, asset]) => {
  const sourceFrames = asset.parts.map(part => {
    const start = new Vector3(...part.start as Vec3), direction = new Vector3(...part.end as Vec3).sub(start);
    return { length: direction.length(), inverse: new Matrix4().compose(start, new Quaternion().setFromUnitVectors(up, direction.normalize()), new Vector3(1,1,1)).invert() };
  });
  return [bodyType, { asset, targets: createMorphTargets(asset), sourceFrames, sourceBodyHeight: asset.height - sourceFrames[asset.parts.findIndex(p => p.id === "head")].length }];
}));

// CPU skinning is intentional: the browser and deterministic PNG rasterizer
// consume the very same deformed triangles, including cloned body modules.
export function createCharacterModel(actor: SpatialCharacter, options: { handCreases?: boolean } = {}): Group {
  if (actor.appearance === "geometric") return createGeometricCharacterModel(actor);
  const handCreases = options.handCreases ?? true;
  const { asset, targets, sourceFrames, sourceBodyHeight } = sources[actor.bodyType ?? "male"];
  const group = new Group(), world = jointWorldTransforms(actor);
  const ratio = actor.height / asset.height;
  const shape = spatialShape(actor.headRatio);
  const [lower, upper, blend] = spatialReferenceBlend(actor.headRatio);
  const matrices = new Map<string, Matrix4>();
  const surfaces: { geometry: BufferGeometry; keys: string[] }[] = [];
  const transform = (bone: SpatialBone | undefined, partIndex: number) => {
    const key = `${bone?.id ?? "root"}/${partIndex}`;
    if (matrices.has(key)) return matrices.get(key)!;
    const source = sourceFrames[partIndex];
    const part = asset.parts[partIndex];
    const bodyWidth = ratio * partWidth(shape, part.id) * (part.id.endsWith("-hand") ? actor.palmSize ?? 1 : 1);
    const start = bone ? world[bone.startJointId].position : vector(actor.position);
    const end = actor.joints.find(j => j.id === (bone?.endJointId ?? "spine"));
    const offset = end ? proportionedJointOffset(actor, end) : new Vector3(0, source.length * ratio, 0);
    const footSize = part.id.endsWith("-foot") ? actor.footSize ?? 1 : 1;
    const footHeight = footHeightScale(footSize);
    // Build the established profile first, then grow around the lifted ankle;
    // thickness follows gently instead of leaving a large foot flattened.
    offset.x /= footSize; offset.y /= footHeight; offset.z /= footSize;
    const longitudinal = offset.length() / source.length;
    const lateral = part.id === "head" ? longitudinal : bodyWidth;
    const rotation = bone ? world[bone.endJointId].rotation.clone() : quaternion(actor.rotation);
    let matrix: Matrix4;
    const hand = bone && fingerPart(part.id) ? owningHand(actor,bone) : undefined;
    if (hand) {
      matrix = new Matrix4().compose(start,rotation,new Vector3(1,1,1)).multiply(fingerRestMatrix(actor,hand,part.id))
        .multiply(new Matrix4().makeTranslation(-part.start[0],-part.start[1],-part.start[2]));
    } else if (["pelvis", "spine", "chest", "neck"].includes(part.id) || /-(shoulder|hip)$/.test(part.id)) {
      // Torso and cross-body attachments widen in anatomical X/Z, not around
      // their differently tilted bone axes, which would fold their shared skin.
      const direction = vector(part.end as Vec3).sub(vector(part.start as Vec3));
      const vertical = Math.abs(direction.y) > .0001 ? offset.y / direction.y : (actor.height - actor.height / actor.headRatio) / sourceBodyHeight;
      const scale = new Vector3(bodyWidth, vertical, ratio * shape.torsoDepth);
      const aligned = rotation.clone().multiply(new Quaternion().setFromUnitVectors(direction.clone().multiply(scale).normalize(), offset.clone().normalize()));
      const origin = new Matrix4().makeTranslation(-part.start[0], -part.start[1], -part.start[2]);
      matrix = new Matrix4().compose(start, aligned, scale).multiply(origin);
      const anatomicalAxis = end && vector(end.offset).normalize().dot(direction.clone().normalize()) > 1 - 1e-6;
      if (shape.softness > 0 && anatomicalAxis && ["pelvis", "spine", "chest", "neck"].includes(part.id)) {
        // Keep horizontal cross-sections horizontal in rest space. A shear
        // maps both joint endpoints exactly while depth changes independently
        // from spine curvature; only authored bone rotations then pose it.
        // Custom attachment directions (e.g. side-by-side heads) keep their
        // own frame rather than being flattened into the anatomical Y axis.
        const rest = new Matrix4().set(
          scale.x, (offset.x - direction.x * scale.x) / direction.y, 0, 0,
          0, scale.y, 0, 0,
          0, (offset.z - direction.z * scale.z) / direction.y, scale.z, 0,
          0, 0, 0, 1,
        );
        const upright = new Matrix4().compose(start, rotation, new Vector3(1,1,1)).multiply(rest).multiply(origin);
        matrix.elements.forEach((value, i) => { matrix.elements[i] = value + (upright.elements[i] - value) * shape.softness; });
      }
    } else {
      const posed = rotation.clone().multiply(new Quaternion().setFromUnitVectors(up, offset.clone().normalize()));
      matrix = new Matrix4().compose(start, posed, new Vector3(lateral, longitudinal, part.id === "head" ? lateral * shape.headDepth : lateral)).multiply(source.inverse);
      if (part.id.endsWith("-foot") && shape.softness > 0) {
        // Broaden/lengthen the soft foot without inflating its sole below the
        // floor, blending back to the original bone-axis shape at seven heads.
        const direction = vector(part.end as Vec3).sub(vector(part.start as Vec3));
        const scale = new Vector3(bodyWidth, offset.y / direction.y, offset.z / direction.z);
        rotation.multiply(new Quaternion().setFromUnitVectors(direction.multiply(scale).normalize(), offset.clone().normalize()));
        const flat = new Matrix4().compose(start, rotation, scale).multiply(new Matrix4().makeTranslation(-part.start[0], -part.start[1], -part.start[2]));
        matrix.elements.forEach((value, i) => { matrix.elements[i] = value + (flat.elements[i] - value) * shape.softness; });
      }
    }
    if (footSize !== 1) {
      const frame = new Matrix4().compose(start,bone ? world[bone.endJointId].rotation : quaternion(actor.rotation),new Vector3(1,1,1));
      matrix.premultiply(frame.clone().multiply(new Matrix4().makeScale(footSize,footHeight,footSize)).multiply(frame.invert()));
    }
    matrices.set(key,matrix); return matrix;
  };
  const regular = new Map(actor.bones.filter(b=>b.id===b.modelPart).map(b=>[b.modelPart,b]));
  const renderModule = (module: typeof asset.modules[number], bone?: SpatialBone) => {
    const prefix = bone && bone.id.endsWith(bone.modelPart) ? bone.id.slice(0,-bone.modelPart.length) : "";
    const cloned = Boolean(bone && bone.id !== bone.modelPart);
    const transforms = asset.parts.map((part,index) => {
      const corresponding = cloned ? actor.bones.find(b=>b.id === `${prefix}${part.id}`) : regular.get(part.id);
      // Weights crossing a cloned attachment use that module's frame. This
      // keeps the new limb attached without pulling on the original torso.
      return corresponding ? transform(corresponding,index) : cloned && bone ? transform(bone,module.part) : transform(undefined,index);
    });
    const vertices = [...new Set(module.indices)], remap = new Map(vertices.map((v,i)=>[v,i]));
    const positions: number[] = [], rest: number[] = [], value = new Vector3(), weighted = new Vector3(), original = new Vector3();
    for (const vertex of vertices) {
      original.set(...[0,1,2].map(axis => {
        const index = vertex * 3 + axis;
        return targets[lower][index] + (targets[upper][index] - targets[lower][index]) * blend;
      }) as Vec3); value.set(0,0,0);
      if (handCreases) rest.push(...original.toArray());
      let total = 0;
      for (let k=0;k<4;k++) {
        const weight = asset.weights[vertex*4+k]; if (!weight) continue;
        weighted.copy(original).applyMatrix4(transforms[asset.influences[vertex*4+k]]);
        value.addScaledVector(weighted,weight); total += weight;
      }
      positions.push(...value.divideScalar(total).toArray());
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
    geometry.setIndex(module.indices.map(v=>remap.get(v)!)); geometry.computeVertexNormals();
    if (module.material === "body" && shape.softness > 0) surfaces.push({ geometry, keys: vertices.map(v => `${prefix}/${asset.positions.slice(v*3,v*3+3).join(",")}`) });
    const color = new Color(module.material === "brows" ? "#514235" : module.material === "eyes" ? "#e7ded1" : actor.color);
    const simpleFace = (lower < 2 ? 1 - blend : 0) + (upper < 2 ? blend : 0);
    if (module.material === "brows") color.lerp(new Color(actor.color),simpleFace * .9);
    if (module.material === "eyes") color.lerp(new Color("#514235"),simpleFace);
    const mesh = new Mesh(geometry,new MeshLambertMaterial({ color,side:DoubleSide }));
    mesh.userData = { characterId:actor.id, ...(bone ? { boneId:bone.id } : {}), modelPart:asset.parts[module.part].id };
    group.add(mesh);
    if (handCreases) {
      const creases = createFingerCreases(actor, asset.parts[module.part].id, rest, positions, module.indices.map(v => remap.get(v)!));
      if (creases) {
        // Bias only the skin's depth to avoid coplanar flicker; creases retain
        // their exact surface positions and remain hidden by other geometry.
        mesh.material.polygonOffset = true;
        mesh.material.polygonOffsetFactor = 1;
        mesh.material.polygonOffsetUnits = 1;
        creases.userData = { ...mesh.userData, reference: "finger-crease" }; group.add(creases);
      }
    }
  };
  for (const module of asset.modules) {
    const part = asset.parts[module.part].id;
    if (part === "pelvis") renderModule(module);
    else for (const bone of actor.bones.filter(b=>b.modelPart===part)) renderModule(module,bone);
  }
  // Modules remain individually selectable, but their shared skin must have
  // shared shading too. Separate normal generation exposed zigzag seams on
  // the rounded targets even where the vertex positions matched exactly.
  const normals = new Map<string,Vector3>(), a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (const { geometry, keys } of surfaces) {
    const positions = geometry.getAttribute("position"), indices = geometry.index!;
    for (let i = 0; i < indices.count; i += 3) {
      const vertices = [indices.getX(i),indices.getX(i+1),indices.getX(i+2)];
      a.fromBufferAttribute(positions,vertices[0]); b.fromBufferAttribute(positions,vertices[1]); c.fromBufferAttribute(positions,vertices[2]);
      const normal = b.sub(a).cross(c.sub(a));
      for (const vertex of vertices) {
        const key = keys[vertex];
        if (!normals.has(key)) normals.set(key,new Vector3());
        normals.get(key)!.add(normal);
      }
    }
  }
  for (const normal of normals.values()) normal.normalize();
  for (const { geometry, keys } of surfaces) {
    const attribute = geometry.getAttribute("normal");
    keys.forEach((key,i) => { a.fromBufferAttribute(attribute,i).lerp(normals.get(key)!,shape.softness).normalize(); attribute.setXYZ(i,a.x,a.y,a.z); });
  }
  return group;
}
