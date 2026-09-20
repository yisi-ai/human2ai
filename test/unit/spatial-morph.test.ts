import { describe, expect, it } from "vitest";
import { Box3, Mesh, Vector3 } from "three";
import { applySpatialOperations, createHumanoid, createSpatialDraft, jointWorldTransforms, type SpatialBodyType } from "../../src/domain/spatial/index.ts";
import { createCharacterModel } from "../../src/domain/spatial/model.ts";
import { createMorphTargets } from "../../src/domain/spatial/morph.ts";
import { disposeSpatialScene } from "../../src/domain/spatial/scene.ts";
import male from "../../src/domain/spatial/assets/quaternius-superhero.json" with { type: "json" };
import female from "../../src/domain/spatial/assets/quaternius-superhero-female.json" with { type: "json" };

const measure = (heads: number, bodyType: SpatialBodyType) => {
  const actor = createHumanoid("p", "P", 1.8, heads, undefined, bodyType), model = createCharacterModel(actor);
  try {
    const vertices = model.children.flatMap(o => [...(o as Mesh).geometry.getAttribute("position").array]);
    const head = new Box3(); model.children.filter(o => o.userData.modelPart === "head").forEach(o => head.union(new Box3().setFromObject(o)));
    const chest = new Box3(); model.children.filter(o => o.userData.modelPart === "chest").forEach(o => chest.union(new Box3().setFromObject(o)));
    const waist = new Box3(); model.children.filter(o => o.userData.modelPart === "spine").forEach(o => waist.union(new Box3().setFromObject(o)));
    const calf = new Box3(), foot = new Box3();
    model.children.filter(o => o.userData.modelPart === "left-ankle").forEach(o => calf.union(new Box3().setFromObject(o)));
    model.children.filter(o => o.userData.modelPart === "left-foot").forEach(o => foot.union(new Box3().setFromObject(o)));
    return { vertices, head: head.getSize(new Vector3()), chest: chest.getSize(new Vector3()), waist: waist.getSize(new Vector3()), calf: calf.getSize(new Vector3()), foot: foot.getSize(new Vector3()), waistCenter: waist.getCenter(new Vector3()), bounds: new Box3().setFromObject(model), world: jointWorldTransforms(actor) };
  } finally { disposeSpatialScene(model); }
};

describe("continuous low-head-count morphology", () => {
  it.each(["male", "female"] as const)("preserves both dimensions of %s finger cross-sections in low-count targets", bodyType => {
    const asset = bodyType === "male" ? male : female;
    const targets = createMorphTargets(asset);
    for (const side of ["left", "right"]) {
      const hand = asset.parts.find(p => p.id === `${side}-hand`)!;
      const tip = asset.parts.find(p => p.id === `${side}-middle-3`)!.end;
      const vertices = [...new Set(asset.modules.filter(m => asset.parts[m.part].id.startsWith(`${side}-middle-`)).flatMap(m => m.indices))];
      // Sample the middle finger shaft by the source landmarks, rather than a
      // whole-hand box that would conceal flattened individual fingers.
      const x = hand.start[0] + .76 * (tip[0] - hand.start[0]);
      const section = vertices.filter(v => Math.abs(asset.positions[v*3] - x) < .007 && Math.abs(asset.positions[v*3+2] - tip[2]) < .014);
      expect(section.length).toBeGreaterThan(8);
      const extent = (positions: number[], axis: number) => Math.max(...section.map(v => positions[v*3+axis])) - Math.min(...section.map(v => positions[v*3+axis]));
      for (const target of targets.slice(0,3)) for (const axis of [1,2]) {
        const retained = extent(target,axis) / extent(asset.positions,axis);
        expect(retained).toBeGreaterThan(.8);
        expect(retained).toBeLessThan(1.2);
      }
    }
  });

  it.each(["male", "female"] as const)("gives %s two- and three-head figures distinct rounded silhouettes with substantial lower limbs", bodyType => {
    const two = measure(2,bodyType), three = measure(3,bodyType);
    // Two heads has fuller cheeks and an almost unbroken chest/waist volume;
    // three heads starts to recover a waist without reverting to adult anatomy.
    expect(two.head.x / two.head.y - three.head.x / three.head.y).toBeGreaterThan(.03);
    expect(two.waist.x / two.chest.x).toBeGreaterThan(.95);
    expect(three.waist.x / three.chest.x).toBeGreaterThan(.9);
    expect(three.waist.x / three.chest.x).toBeLessThan(two.waist.x / two.chest.x);
    expect(two.calf.x / two.head.y).toBeGreaterThan(.13);
    expect(two.foot.z / two.head.y).toBeGreaterThan(.23);
  });

  it.each(["male", "female"] as const)("joins %s two-head skin normals across selectable modules and UV seams", bodyType => {
    const asset = bodyType === "male" ? male : female;
    const draft = applySpatialOperations({ ...createSpatialDraft(), characters: [createHumanoid("p","P",1.8,2,undefined,bodyType)] }, [
      { type: "rotate-bone", characterId: "p", boneId: "left-knee", rotation: [-78,0,5] },
    ]).draft;
    const model = createCharacterModel(draft.characters[0]), seen = new Map<string,Vector3>();
    try {
      const meshes = model.children.filter((object): object is Mesh => object instanceof Mesh);
      let shared = 0;
      asset.modules.forEach((module,i) => {
        if (module.material !== "body") return;
        const normals = meshes[i].geometry.getAttribute("normal");
        [...new Set(module.indices)].forEach((vertex,index) => {
          const key = asset.positions.slice(vertex*3,vertex*3+3).join(",");
          const normal = new Vector3().fromBufferAttribute(normals,index);
          expect(normal.length()).toBeCloseTo(1,5);
          if (seen.has(key)) { expect(normal.distanceTo(seen.get(key)!)).toBeLessThan(1e-6); shared++; }
          seen.set(key,normal);
        });
      });
      expect(shared).toBeGreaterThan(100);
    } finally { disposeSpatialScene(model); }
  });

  it.each(["male", "female"] as const)("does not amplify the %s rest spine curvature when thickening a low-count body", bodyType => {
    for (const heads of [2, 2.5, 3, 3.5, 4]) for (const torsoRatio of [.3, .4, .7]) {
      const actor = createHumanoid("p", "P", 1.8, heads, torsoRatio, bodyType);
      const world = jointWorldTransforms(actor);
      const waist = world.spine.position.clone().sub(world.pelvis.position);
      expect(Math.abs(waist.z / waist.y)).toBeLessThan(.25);
      expect(Math.abs(world.neck.position.z - world.pelvis.position.z)).toBeLessThan(.035);
      expect(world.head.position.y).toBeCloseTo(actor.height, 10);
    }
    for (const heads of [2, 2.5, 3, 3.5, 4]) {
      const result = measure(heads, bodyType);
      expect(Math.abs(result.waistCenter.z - result.world.pelvis.position.z)).toBeLessThan(.045);
    }
  });

  it.each(["male", "female"] as const)("keeps %s fractional head measurements and continuous geometry across references", bodyType => {
    for (const heads of [2, 2.5, 2.7, 3, 3.5, 4, 7]) {
      const result = measure(heads, bodyType);
      expect(result.vertices.every(Number.isFinite)).toBe(true);
      expect(result.world.head.position.distanceTo(result.world.neck.position)).toBeCloseTo(1.8 / heads, 10);
      expect(result.bounds.max.y).toBeCloseTo(1.8, 5);
      expect(Math.abs(result.bounds.min.y)).toBeLessThan(.005);
      // The rig reference is exact above; the chin also carries neck weights.
      if (heads < 4) expect(Math.abs(result.head.y / (1.8 / heads) - 1)).toBeLessThan(.03);
      if (heads <= 4) {
        // Keep the large head supported in profile without making a flat head
        // or flattening the torso while reducing the original muscular relief.
        expect(result.head.z / result.chest.z).toBeLessThan(2.5);
        expect(result.head.z / result.head.y).toBeGreaterThan(.65);
        expect(result.chest.z / result.chest.x).toBeGreaterThan(.65);
      }
      for (const neighbor of [heads - .00001, heads + .00001].filter(n => n >= 2)) {
        const adjacent = measure(neighbor, bodyType);
        expect(adjacent.vertices.length).toBe(result.vertices.length);
        let largest = 0;
        for (let i = 0; i < result.vertices.length; i++) largest = Math.max(largest, Math.abs(adjacent.vertices[i] - result.vertices[i]));
        expect(largest).toBeLessThan(.00002);
      }
    }
    const small = measure(2, bodyType), adult = measure(7, bodyType);
    expect(small.head.x / small.head.y).toBeGreaterThan(adult.head.x / adult.head.y * 1.2);
    expect(small.world.neck.position.distanceTo(small.world.chest.position)).toBeLessThan(.05);
    expect(measure(2.7, bodyType).vertices).not.toEqual(measure(2.5, bodyType).vertices);
  });

  it.each(["male", "female"] as const)("keeps %s shared module vertices joined in raised, squatting and kicking poses", bodyType => {
    const asset = bodyType === "male" ? male : female;
    for (const heads of [2.5, 3.5]) for (const pose of [
      [{ type: "rotate-bone" as const, characterId: "p", boneId: "left-elbow", rotation: [-30,0,95] as [number,number,number] }],
      ["left", "right"].flatMap(side => [
        { type: "rotate-bone" as const, characterId: "p", boneId: `${side}-knee`, rotation: [-70,0,0] as [number,number,number] },
        { type: "rotate-bone" as const, characterId: "p", boneId: `${side}-ankle`, rotation: [100,0,0] as [number,number,number] },
      ]),
      [{ type: "rotate-bone" as const, characterId: "p", boneId: "left-knee", rotation: [-78,0,5] as [number,number,number] }],
    ]) {
      const draft = applySpatialOperations({ ...createSpatialDraft(), characters: [createHumanoid("p", "P", 1.8, heads, undefined, bodyType)] }, pose).draft;
      const model = createCharacterModel(draft.characters[0]), seen = new Map<number, Vector3>();
      try {
        const meshes = model.children.filter((object): object is Mesh => object instanceof Mesh);
        let shared = 0;
        asset.modules.forEach((module, i) => {
          const positions = meshes[i].geometry.getAttribute("position");
          [...new Set(module.indices)].forEach((vertex, index) => {
            const point = new Vector3().fromBufferAttribute(positions, index);
            expect(point.toArray().every(Number.isFinite)).toBe(true);
            if (seen.has(vertex)) { expect(point.distanceTo(seen.get(vertex)!)).toBeLessThan(1e-7); shared++; }
            seen.set(vertex, point);
          });
        });
        expect(shared).toBeGreaterThan(100);
      } finally { disposeSpatialScene(model); }
    }
  });

  it("retains custom limbs, poses and locks through fractional changes and a round trip", () => {
    const source = applySpatialOperations({ ...createSpatialDraft(), characters: [createHumanoid("p", "P")] }, [
      { type: "add-limb", characterId: "p", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "extra", offset: [.2,-.15,0] },
      { type: "add-limb", characterId: "p", sourceJointId: "neck", parentId: "chest", idPrefix: "second", offset: [.2,.2,0] },
      { type: "rotate-bone", characterId: "p", boneId: "left-knee", rotation: [-78,0,5] },
      { type: "lock-bone", characterId: "p", boneId: "left-hand", rotation: true },
    ]).draft;
    const resize = (draft: typeof source, headRatio: number) => applySpatialOperations(draft, [{ type: "set-proportions", characterId: "p", height: 1.8, headRatio }]).draft;
    const small = resize(source, 2.7);
    expect(small.characters[0].headRatio).toBe(2.7);
    expect(small.characters[0].bones).toEqual(source.characters[0].bones);
    expect(small.characters[0].joints.map(j => j.id)).toEqual(source.characters[0].joints.map(j => j.id));
    const restored = resize(small, 7);
    const a = createCharacterModel(source.characters[0]), b = createCharacterModel(restored.characters[0]);
    try { a.children.forEach((mesh, i) => expect((mesh as Mesh).geometry.getAttribute("position").array).toEqual((b.children[i] as Mesh).geometry.getAttribute("position").array)); }
    finally { disposeSpatialScene(a); disposeSpatialScene(b); }
    const pinned = applySpatialOperations(small, [{ type: "lock-joint", characterId: "p", jointId: "left-wrist", position: true }]).draft;
    const saved = structuredClone(pinned);
    expect(() => resize(pinned, 3.5)).toThrow(/Fixed world position/);
    expect(pinned).toEqual(saved);
  });
});
