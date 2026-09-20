import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { BoxGeometry, CylinderGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshLambertMaterial, Quaternion, Raycaster, Triangle, Vector3 } from "three";
import { applySpatialOperations, createHumanoid, createSpatialDraft } from "../../src/domain/spatial/index.js";
import { createSpatialScene, disposeSpatialScene } from "../../src/domain/spatial/scene.ts";
import * as sceneBuilder from "../../src/domain/spatial/scene.ts";
import type { SpatialCamera, SpatialDraft } from "../../src/domain/spatial/types.ts";
import { renderSpatialPng } from "../../src/server/spatial-render.js";
import { fingerBasis, handRestMatrix, handRig, owningHand } from "../../src/domain/spatial/hands.ts";
import { createFingerCreases } from "../../src/domain/spatial/reference-lines.ts";

const channel = (pixels: Buffer, index: number) => pixels.filter((_, i) => i % 4 === index);

it("renders depth occlusion independently of insertion order and preserves transparent framing", async () => {
  const draft = createSpatialDraft();
  const camera = { ...draft.cameras[0], position: [0, 0, 5] as [number, number, number], target: [0, 0, 0] as [number, number, number], projection: "orthographic" as const, span: 4, width: 128, height: 128 };
  draft.objects = [
    { id: "near", name: "Near", kind: "box", position: [0, 0, 1], rotation: [0, 0, 0], size: [1, 1, 1], color: "#ff0000" },
    { id: "far", name: "Far", kind: "box", position: [0, 0, -1], rotation: [0, 0, 0], size: [2, 2, 1], color: "#0000ff" },
  ];
  const png = await renderSpatialPng(draft, camera);
  expect((await renderSpatialPng({ ...draft, objects: [...draft.objects].reverse() }, camera)).equals(png)).toBe(true);
  const raw = await sharp(png).raw().toBuffer();
  const pixel = (x: number, y: number) => [...raw.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
  expect(pixel(64, 64)[0]).toBeGreaterThan(100);
  expect(pixel(64, 64)[2]).toBe(0);
  expect(pixel(42, 64)[2]).toBeGreaterThan(100);
  expect(pixel(0, 0)[3]).toBe(0);
  const side = await renderSpatialPng(draft, { ...camera, position: [5, 2, 0] });
  expect(side.equals(png)).toBe(false);
  const solid = await renderSpatialPng(draft, { ...camera, background: "#ffffff" });
  expect([...await sharp(solid).raw().toBuffer()].filter((_, i) => i % 4 === 3).every(alpha => alpha === 255)).toBe(true);
});

it.each(["perspective","orthographic"] as const)("separates close geometric parts in %s color references without exposing hidden edges", async projection => {
  const draft = createSpatialDraft();
  draft.characters = [createHumanoid("p","Person",1.8,7,undefined,"male",{appearance:"geometric"})];
  const view = {...draft.cameras[0],position:[0,0,5] as [number,number,number],target:[0,0,0] as [number,number,number],projection,span:4,fov:45,width:256,height:256};
  let covered = false, reverse = false;
  const spy = vi.spyOn(sceneBuilder,"createSpatialScene").mockImplementation(() => {
    const group = new Group();
    const back = new Mesh(new BoxGeometry(2,2,.1),new MeshLambertMaterial({color:"#aaaaaa"}));
    const front = new Mesh(new BoxGeometry(1,1,.1),new MeshLambertMaterial({color:"#aaaaaa"}));
    back.userData = {characterId:"p",boneId:"chest",modelPart:"chest"};
    front.userData = {characterId:"p",boneId:"left-wrist",modelPart:"left-wrist"};
    // Close surfaces should remain distinguishable without a large depth jump.
    front.position.set(.25,0,.002);
    for (const mesh of reverse ? [front,back] : [back,front]) group.add(mesh);
    if (covered) {
      const cover = new Mesh(new BoxGeometry(3,3,.1),new MeshLambertMaterial({color:"#aaaaaa"}));
      cover.position.z=.2; cover.userData={objectId:"cover"}; group.add(cover);
    }
    group.updateMatrixWorld(true); return group;
  });
  const raw = async (value=draft, pass: "color" | "structure" | "depth" = "color") => sharp(await renderSpatialPng(value,view,pass)).ensureAlpha().raw().toBuffer();
  const plain = {...draft,characters:[{...draft.characters[0],appearance:"quaternius" as const}]};
  try {
    const outlined=await raw(), smooth=await raw(plain);
    const scale=projection==="orthographic" ? 64 : 128/(4.948*Math.tan(Math.PI/8));
    const edge=Math.round(128-.25*scale), middle=128, row=128;
    const red=(pixels: Buffer,x: number)=>pixels[(row*256+x)*4];
    expect(Math.min(...[-1,0,1].map(dx=>red(outlined,edge+dx)))).toBeLessThan(red(smooth,edge)*.75);
    expect(red(outlined,middle)).toBe(red(smooth,middle));
    expect(Buffer.compare(channel(outlined,3),channel(smooth,3))).toBe(0);
    reverse=true; expect((await raw()).equals(outlined)).toBe(true);
    for (const pass of ["depth","structure"] as const) expect((await raw(draft,pass)).equals(await raw(plain,pass))).toBe(true);
    covered=true; expect((await raw()).equals(await raw(plain))).toBe(true);
  } finally { spy.mockRestore(); }
});

describe("camera reference passes", () => {
  const camera = (projection: SpatialCamera["projection"]): SpatialCamera => ({ ...createSpatialDraft().cameras[0], position: [0, 0, 5], target: [0, 0, 0], projection, fov: 45, span: 4, width: 256, height: 256 });
  const pixels = async (draft: SpatialDraft, view: SpatialCamera, pass: "color" | "structure" | "depth") => sharp(await renderSpatialPng(draft, view, pass)).ensureAlpha().raw().toBuffer();
  const at = (data: Buffer, x: number, y: number) => [...data.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 4)];

  it.each(["male","female"] as const)("places %s thumb IP creases on the inner side of the mirrored blue hinge", bodyType => {
    const actor = createHumanoid("p","Person",1.8,3,undefined,bodyType);
    for (const side of ["left","right"]) {
      const bone = actor.bones.find(b=>b.id===`${side}-thumb-3`)!;
      const part = handRig(actor).parts.find(p=>p.id===bone.modelPart)!;
      const origin = new Vector3(...part.start as [number,number,number]);
      const direction = new Vector3(...part.end as [number,number,number]).sub(origin).normalize();
      const hinge = new Vector3(0,0,1).applyQuaternion(fingerBasis(actor,bone)).transformDirection(handRestMatrix(actor,owningHand(actor,bone)!,false).invert());
      const sign = side==="left" ? -1 : 1;
      // The actual allowed Z motion identifies the compression side, without
      // repeating the crease implementation's rest-space frame construction.
      const fold = direction.clone().applyAxisAngle(hinge,sign*.001).sub(direction).normalize();
      const skin = new CylinderGeometry(.006,.006,.04,32,1,true);
      skin.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction)); skin.translate(...origin.toArray());
      const rest = Array.from(skin.getAttribute("position").array);
      const crease = createFingerCreases(actor,bone.modelPart,rest,rest,Array.from(skin.index!.array));
      try {
        expect(crease).not.toBeNull();
        const points = crease!.geometry.getAttribute("position"), center = new Vector3(), span: number[] = [];
        for (let i=0;i<points.count;i++) {
          const offset = new Vector3().fromBufferAttribute(points,i).sub(origin);
          expect(Math.abs(offset.dot(direction))).toBeLessThan(2e-7);
          expect(offset.dot(fold)).toBeGreaterThan(-1e-5);
          center.add(offset); span.push(offset.dot(hinge));
        }
        expect(center.divideScalar(points.count).dot(fold)).toBeGreaterThan(.003);
        expect(Math.max(...span)-Math.min(...span)).toBeGreaterThan(.011);
      } finally { skin.dispose(); if (crease) { crease.geometry.dispose(); (crease.material as LineBasicMaterial).dispose(); } }
    }
  });

  it.each(["perspective", "orthographic"] as const)("uses one linear depth range and the color silhouette for %s cameras", async projection => {
    const draft = createSpatialDraft(), view = camera(projection);
    draft.objects = [-1, 0, 1].map((x, i) => ({ id: `box-${i}`, name: "Box", kind: "box", position: [x, 0, 1 - i], rotation: [0, 0, 0], size: [.5, .5, .5], color: "#777777" }));
    const depth = await pixels(draft, view, "depth"), color = await pixels(draft, view, "color");
    const samples = draft.objects.map((_, i) => {
      const x = projection === "orthographic" ? 64 + i * 64 : Math.round(128 + (i - 1) / (3.75 + i) / Math.tan(Math.PI / 8) * 128);
      return at(depth, x, 128)[0];
    });
    expect(samples[0]).toBeGreaterThan(samples[1]); expect(samples[1]).toBeGreaterThan(samples[2]);
    expect(Math.abs(samples[0] + samples[2] - 2 * samples[1])).toBeLessThanOrEqual(2);
    const gray = channel(depth, 0);
    const depthMask = gray.map(value => value > 0 ? 255 : 0);
    const colorMask = channel(color, 3).map(value => value > 0 ? 255 : 0);
    expect(Buffer.compare(depthMask, colorMask)).toBe(0);
    expect(Buffer.compare(channel(depth, 1), gray)).toBe(0);
    expect(Buffer.compare(channel(depth, 2), gray)).toBe(0);
    expect(channel(depth, 3).every(alpha => alpha === 255)).toBe(true);
    expect(at(depth, 0, 0)).toEqual([0, 0, 0, 255]);
    expect((await pixels({ ...draft, objects: [...draft.objects].reverse() }, view, "depth")).equals(depth)).toBe(true);
    expect((await pixels(draft, { ...view, background: "#ffffff" }, "depth")).equals(depth)).toBe(true);
  });

  it("includes every character and object without changing the authored scene", async () => {
    const draft = createSpatialDraft(), view = { ...camera("orthographic"), target: [0, 1, 0] as [number, number, number], position: [0, 1, 5] as [number, number, number], span: 3 };
    draft.characters = [createHumanoid("a", "A"), createHumanoid("b", "B", 1.8, 3, undefined, "female")];
    draft.characters[0].position = [-.7, 0, 1]; draft.characters[1].position = [.7, 0, -1];
    draft.objects = [{ id: "prop", name: "Prop", kind: "box", position: [0, .3, 2], rotation: [0, 0, 0], size: [.3, .3, .3], color: "#ff0000" }];
    const original = structuredClone(draft), full = await pixels(draft, view, "depth");
    for (const patch of [{ characters: [draft.characters[0]] }, { characters: [draft.characters[1]] }, { objects: [] }]) expect((await pixels({ ...draft, ...patch }, view, "depth")).equals(full)).toBe(false);
    expect((await pixels({ ...draft, characters: [...draft.characters].reverse() }, view, "depth")).equals(full)).toBe(true);
    await renderSpatialPng(draft, view, "structure"); expect(draft).toEqual(original);
  });

  it("hides all finger lines behind a scene object and clips behind-camera geometry", async () => {
    const draft = createSpatialDraft(); draft.characters = [createHumanoid("p", "Person")];
    const view = { ...camera("perspective"), position: [0, 1, 5] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
    draft.objects = [{ id: "cover", name: "Cover", kind: "box", position: [0, 1, 3], rotation: [0, 0, 0], size: [10, 10, .2], color: "#ffffff" }];
    const covered = await pixels(draft, view, "structure");
    expect(covered.every(value => value === 255)).toBe(true);
    expect((await pixels({ ...draft, characters: [] }, view, "structure")).equals(covered)).toBe(true);
    expect((await pixels(draft, view, "color")).equals(await pixels({ ...draft, characters: [] }, view, "color"))).toBe(true);
    draft.objects[0].position[2] = 6;
    expect((await pixels(draft, view, "depth")).equals(await pixels({ ...draft, objects: [] }, view, "depth"))).toBe(true);
    expect((await pixels({ ...draft, characters: [], objects: [] }, view, "depth")).equals(Buffer.from(Array.from({ length: 256 * 256 * 4 }, (_, i) => i % 4 === 3 ? 255 : 0)))).toBe(true);
  });

  it.each(["male", "female"] as const)("keeps %s finger creases on the posed skin, including short proportions and cloned hands", bodyType => {
    let draft = { ...createSpatialDraft(), characters: [createHumanoid("p", "Person", 1.8, 2.5, undefined, bodyType, { palmSize: 1.2, fingerLength: .6 })] };
    draft = applySpatialOperations(draft, [
      { type: "add-limb", characterId: "p", sourceJointId: "right-shoulder", parentId: "chest", idPrefix: "extra", offset: [-.2, -.2, 0] },
      { type: "pose-hand", characterId: "p", handBoneId: "extra-right-hand", curl: { index: .8, thumb: .5 }, thumbOpposition: .5 },
    ]).draft;
    const scene = createSpatialScene(draft), smooth = createSpatialScene(draft, { handCreases: false });
    try {
      const meshes: Mesh[] = [], lines: LineSegments[] = [];
      scene.traverse(object => { if (object instanceof Mesh) meshes.push(object); else if (object instanceof LineSegments) lines.push(object); });
      expect(lines.some(line => line.userData.boneId.startsWith("extra-"))).toBe(true);
      expect(lines.some(line => line.userData.boneId.startsWith("left-"))).toBe(true);
      smooth.traverse(object => expect(object instanceof LineSegments).toBe(false));
      for (const line of lines) {
        expect(new Raycaster().intersectObject(line)).toEqual([]);
        expect((line.material as LineBasicMaterial).depthTest).toBe(true);
        expect((line.material as LineBasicMaterial).depthWrite).toBe(false);
        const mesh = meshes.find(mesh => mesh.userData.boneId === line.userData.boneId)!;
        const positions = mesh.geometry.getAttribute("position"), indices = mesh.geometry.index!;
        const segments = line.geometry.getAttribute("position");
        const triangles: Triangle[] = [];
        for (let i = 0; i < indices.count; i += 3) triangles.push(new Triangle(...[0, 1, 2].map(j => new Vector3().fromBufferAttribute(positions, indices.getX(i + j))) as [Vector3, Vector3, Vector3]));
        for (let i = 0; i < segments.count; i++) {
          const point = new Vector3().fromBufferAttribute(segments, i);
          expect(Math.min(...triangles.map(triangle => triangle.closestPointToPoint(point, new Vector3()).distanceTo(point)))).toBeLessThan(1e-6);
        }
      }
    } finally { disposeSpatialScene(scene); disposeSpatialScene(smooth); }
  });

  it("shows finger creases in ordinary PNGs without changing the silhouette or depth", async () => {
    const draft = createSpatialDraft(); draft.characters = [createHumanoid("p", "Person")];
    const scene = createSpatialScene(draft);
    const center = new Vector3(), points: Vector3[] = [];
    scene.traverse(object => {
      if (!(object instanceof LineSegments) || !object.userData.boneId.startsWith("left-")) return;
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) points.push(new Vector3().fromBufferAttribute(positions, i));
    });
    for (const point of points) center.add(point);
    center.divideScalar(points.length); disposeSpatialScene(scene);
    const view = { ...camera("orthographic"), position: center.clone().add(new Vector3(0, -1, .3)).toArray() as [number, number, number], target: center.toArray() as [number, number, number], span: .3 };
    const color = await pixels(draft, view, "color"), depth = await pixels(draft, view, "depth");
    const build = sceneBuilder.createSpatialScene;
    const spy = vi.spyOn(sceneBuilder, "createSpatialScene").mockImplementation(value => build(value, { handCreases: false }));
    try {
      const smooth = await pixels(draft, view, "color");
      expect(Buffer.compare(channel(color, 3), channel(smooth, 3))).toBe(0);
      let marks = 0;
      for (let i = 0; i < color.length; i += 4) {
        if (color[i] < smooth[i] - 10) { marks++; expect(color[i + 3]).toBe(255); }
      }
      expect(marks).toBeGreaterThan(100);
      expect((await pixels(draft, view, "depth")).equals(depth)).toBe(true);
    } finally { spy.mockRestore(); }
  });
});
