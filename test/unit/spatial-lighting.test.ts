import { expect, it } from "vitest";
import sharp from "sharp";
import { Mesh, MeshLambertMaterial } from "three";
import { applySpatialOperations, createHumanoid, createSpatialDraft, validateSpatialDraft, type SpatialOperation } from "../../src/domain/spatial/index.ts";
import { applySpatialContactShading, getSpatialLighting, spatialSurfaces, SPATIAL_LIGHTING } from "../../src/domain/spatial/lighting.ts";
import { createSpatialScene, disposeSpatialScene } from "../../src/domain/spatial/scene.ts";
import { renderSpatialPng } from "../../src/server/spatial-render.ts";

const camera = () => ({ ...createSpatialDraft().cameras[0], position: [0,0,5] as [number,number,number], target: [0,0,0] as [number,number,number], projection: "orthographic" as const, span: 1, width: 128, height: 128 });

it("keeps oblique flat surfaces free of shadow sampling stripes", async () => {
  const draft = createSpatialDraft();
  draft.lightingEnabled = true;
  draft.objects = [{ id:"wall",name:"Wall",kind:"box",position:[0,0,0],rotation:[30,15,0],size:[4,4,.2],color:"#ffffff" }];
  const raw = await sharp(await renderSpatialPng(draft,camera())).raw().toBuffer();
  const shades = new Set<number>();
  for (let y=16;y<112;y++) for (let x=16;x<112;x++) shades.add(raw[(y*128+x)*4]);
  expect(shades.size).toBe(1);
  expect([...shades][0]).toBeGreaterThan(180);
});

it("casts shadows from outside the camera without changing depth, framing or the draft", async () => {
  const draft = createSpatialDraft(), view = camera();
  draft.lightingEnabled = true;
  draft.objects = [{ id:"wall",name:"Wall",kind:"box",position:[0,0,-.1],rotation:[0,0,0],size:[4,4,.2],color:"#ffffff" }];
  const clear = await renderSpatialPng(draft,view);
  const depth = await renderSpatialPng(draft,view,"depth"), structure = await renderSpatialPng(draft,view,"structure");
  draft.objects.push({ id:"blocker",name:"Blocker",kind:"box",position:SPATIAL_LIGHTING.direction.map(v=>v*3) as [number,number,number],rotation:[0,0,0],size:[.5,.5,.5],color:"#ffffff" });
  const original = structuredClone(draft), shadow = await renderSpatialPng(draft,view);
  const [lit,dark] = await Promise.all([clear,shadow].map(png=>sharp(png).raw().toBuffer()));
  expect(lit[(64*128+64)*4]-dark[(64*128+64)*4]).toBeGreaterThan(30);
  expect(dark[(8*128+8)*4]).toBe(lit[(8*128+8)*4]);
  expect((await renderSpatialPng(draft,view,"depth")).equals(depth)).toBe(true);
  expect((await renderSpatialPng(draft,view,"structure")).equals(structure)).toBe(true);
  expect((await renderSpatialPng({...draft,objects:[...draft.objects].reverse()},view)).equals(shadow)).toBe(true);
  expect(draft).toEqual(original);
});

it("defaults to an evenly lit scene and preserves pose, locks and cameras when toggled", () => {
  const draft = createSpatialDraft(); draft.characters = [createHumanoid("a","A")];
  draft.characters[0].joints[0].lockPosition = true;
  draft.characters[0].bones[0].lockRotation = true;
  expect(draft.lightingEnabled).toBe(false);
  const omitted = structuredClone(draft); delete omitted.lightingEnabled;
  expect(getSpatialLighting(validateSpatialDraft(omitted))).toEqual(getSpatialLighting(draft));
  const enabled = applySpatialOperations(omitted,[{type:"set-lighting",enabled:true}]).draft;
  expect(enabled).toEqual({...omitted,lightingEnabled:true});
  expect(getSpatialLighting(enabled).key).toBeGreaterThan(0);
  expect(applySpatialOperations(enabled,[{type:"set-lighting",enabled:false}]).draft).toEqual(draft);
  expect(omitted.lightingEnabled).toBeUndefined();
  expect(() => applySpatialOperations(draft,[{type:"set-lighting",enabled:true},{type:"set-lighting",enabled:"yes"} as unknown as SpatialOperation])).toThrow(/SPATIAL_INVALID/);
  expect(() => validateSpatialDraft({...draft,lightingEnabled:"yes"})).toThrow(/SPATIAL_INVALID/);
  expect(draft.lightingEnabled).toBe(false);
});

it("keeps back-facing surfaces bright when disabled while preserving contact shading and geometry passes", async () => {
  const draft = createSpatialDraft(), view = camera();
  draft.objects = [{id:"box",name:"Box",kind:"box",position:[0,0,0],rotation:[0,0,0],size:[.5,.5,.5],color:"#bbbbbb"}];
  const enabled = {...draft,lightingEnabled:true};
  const backside = {...view,position:[0,0,-5] as [number,number,number]};
  const [front,back,dark] = await Promise.all([renderSpatialPng(draft,view),renderSpatialPng(draft,backside),renderSpatialPng(enabled,backside)].map(async png=>sharp(await png).raw().toBuffer()));
  const center = (64*128+64)*4;
  expect(front[center]).toBe(187); expect(back[center]).toBe(187);
  expect(back[center]-dark[center]).toBeGreaterThan(60);
  expect([...front].filter((_,i)=>i%4===3)).toEqual([...dark].filter((_,i)=>i%4===3));
  for (const pass of ["depth","structure"] as const) expect((await renderSpatialPng(draft,view,pass)).equals(await renderSpatialPng(enabled,view,pass))).toBe(true);
  // Both modes use exactly the same contact colors, so turning off the lamps
  // does not remove the local contact cues from fingers or nearby objects.
  const plainScene = createSpatialScene(draft), litScene = createSpatialScene(enabled);
  try { expect(applySpatialContactShading(plainScene,draft)).toEqual(applySpatialContactShading(litScene,enabled)); }
  finally { [plainScene,litScene].forEach(disposeSpatialScene); }
});

it("darkens close contacts between separate objects, and restores cached shading exactly", () => {
  const draft = createSpatialDraft();
  draft.objects = [
    { id:"box",name:"Box",kind:"box",position:[0,.0376,0],rotation:[0,0,0],size:[.1,.06,.1],color:"#ffffff" },
    { id:"floor",name:"Floor",kind:"plane",position:[0,0,0],rotation:[0,0,0],size:[3,1,3],color:"#ffffff" },
  ];
  const near = createSpatialScene(draft), cached = createSpatialScene(draft);
  const far = createSpatialScene({...draft,objects:[draft.objects[0],{...draft.objects[1],position:[0,-1,0]}]});
  try {
    const contacts = applySpatialContactShading(near,draft), open = applySpatialContactShading(far,draft);
    expect(Math.min(...contacts[0])).toBeLessThan(.8);
    expect([...open[0]].every(value=>value===1)).toBe(true);
    applySpatialContactShading(cached,draft,contacts);
    expect([...spatialSurfaces(cached)[0].geometry.getAttribute("color").array]).toEqual([...contacts[0]]);
  } finally { [near,cached,far].forEach(disposeSpatialScene); }
});

it("includes both characters but excludes articulation helpers from contact and shadow casting", () => {
  const draft = createSpatialDraft(); draft.characters = [createHumanoid("a","A"),createHumanoid("b","B",1.8,3,undefined,"female")];
  draft.characters[1].position = [.3,0,0];
  const original = structuredClone(draft), plain = createSpatialScene(draft), rig = createSpatialScene(draft,{showRig:true});
  try {
    const plainColors = applySpatialContactShading(plain,draft), rigColors = applySpatialContactShading(rig,draft);
    expect(rigColors).toEqual(plainColors);
    expect(new Set(spatialSurfaces(rig).map(mesh=>mesh.userData.characterId))).toEqual(new Set(["a","b"]));
    rig.traverse(mesh=>{
      if (!(mesh instanceof Mesh)) return;
      expect(mesh.castShadow).toBe(!mesh.userData.rig);
      expect(mesh.receiveShadow).toBe(!mesh.userData.rig);
      expect((mesh.material as MeshLambertMaterial).vertexColors).toBe(!mesh.userData.rig);
    });
    expect(draft).toEqual(original);
  } finally { [plain,rig].forEach(disposeSpatialScene); }
});
