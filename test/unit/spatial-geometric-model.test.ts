import { expect, it } from "vitest";
import { Box3, Mesh, MeshLambertMaterial, Vector3 } from "three";
import sharp from "sharp";
import { applySpatialOperations, createHumanoid, createSpatialDraft, createSpatialCameraBox, fitSpatialCameraBox, jointWorldTransforms, SPATIAL_RENDER_PASSES, validateSpatialDraft, type SpatialBodyType, type SpatialCharacter } from "../../src/domain/spatial/index.ts";
import { createCharacterModel } from "../../src/domain/spatial/model.ts";
import { createSpatialScene, disposeSpatialScene } from "../../src/domain/spatial/scene.ts";
import { renderSpatialPng, renderSpatialCameraBoxPng } from "../../src/server/spatial-render.ts";

const actor = (heads=7,bodyType: SpatialBodyType="male") => createHumanoid("p","Person",1.8,heads,undefined,bodyType,{appearance:"geometric"});
const draftOf = (character=actor()) => ({...createSpatialDraft(),characters:[character]});
const meshes = (character: SpatialCharacter) => createCharacterModel(character).children as Mesh[];

it.each(["#e3bfa2", "#68869c", "#161b24"])("separates geometric joints from their bones even with body color %s", color => {
  const model = createCharacterModel({...actor(),color});
  const parts = model.children as Mesh[], luminance = (mesh: Mesh) => {
    const c = (mesh.material as MeshLambertMaterial).color;
    return .2126*c.r + .7152*c.g + .0722*c.b;
  };
  try {
    for (const id of ["left-elbow","right-knee",... ["left","right"].flatMap(side=>["thumb","index","middle","ring","little"].map(finger=>`${side}-${finger}-2`))]) {
      const bone = luminance(parts.find(m=>m.userData.boneId===id)!), joint = luminance(parts.find(m=>m.userData.jointId===id)!);
      expect((Math.max(bone,joint)+.05)/(Math.min(bone,joint)+.05)).toBeGreaterThan(1.8);
    }
  } finally { disposeSpatialScene(model); }
});

it("creates geometric characters through operations and switches a pinned custom pose without changing its rig", () => {
  const created = applySpatialOperations(createSpatialDraft(),[{type:"add-character",id:"p",name:"Person",appearance:"geometric"}]).draft;
  expect(created.characters[0].appearance).toBe("geometric");
  const posed = applySpatialOperations(created,[
    {type:"add-limb",characterId:"p",sourceJointId:"left-shoulder",parentId:"chest",idPrefix:"extra",offset:[.2,-.15,0]},
    {type:"pose-hand",characterId:"p",handBoneId:"left-hand",curl:{thumb:.6,index:.8}},
    {type:"lock-joint",characterId:"p",jointId:"left-index-3",position:true},
    {type:"lock-bone",characterId:"p",boneId:"right-elbow",rotation:true},
  ]).draft;
  const changed = applySpatialOperations(posed,[{type:"put-character",character:{...posed.characters[0],appearance:"quaternius"}}]).draft;
  expect({...changed.characters[0],appearance:"geometric"}).toEqual(posed.characters[0]);
  expect(applySpatialOperations(changed,[{type:"put-character",character:posed.characters[0]}]).draft).toEqual(posed);
  expect(()=>validateSpatialDraft({...created,characters:[{...created.characters[0],appearance:"unknown"}]})).toThrow("SPATIAL_INVALID");
  const resized = applySpatialOperations(created,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:3.5,bodyType:"female"},{type:"reset-pose",characterId:"p"}]).draft;
  expect(resized.characters[0]).toMatchObject({appearance:"geometric",headRatio:3.5,bodyType:"female"});
});

it.each(["male","female"] as const)("places selectable %s spheres and cylinders exactly on the posed joints, including cloned fingers and heads", bodyType => {
  const draft = applySpatialOperations(draftOf(actor(3,bodyType)),[
    {type:"add-limb",characterId:"p",sourceJointId:"left-shoulder",parentId:"chest",idPrefix:"extra",offset:[.25,-.12,0]},
    {type:"add-limb",characterId:"p",sourceJointId:"neck",parentId:"chest",idPrefix:"second",offset:[.3,.15,0]},
    {type:"pose-hand",characterId:"p",handBoneId:"extra-left-hand",curl:{thumb:.5,index:.8}},
    {type:"rotate-bone",characterId:"p",boneId:"head",rotation:[10,30,5]},
  ]).draft;
  const character = draft.characters[0], world = jointWorldTransforms(character), model = createCharacterModel(character);
  const parts = model.children as Mesh[];
  expect(parts.filter(m=>m.userData.feature==="eye")).toHaveLength(4);
  expect(parts.filter(m=>m.geometry.type==="BoxGeometry")).toHaveLength(5);
  for (const mesh of parts) {
    expect(mesh.userData.rig).toBeUndefined();
    if (mesh.userData.jointId) {
      expect(mesh.geometry.type).toBe("SphereGeometry");
      expect(mesh.position.distanceTo(world[mesh.userData.jointId].position)).toBeLessThan(1e-10);
    }
    if (mesh.geometry.type!=="CylinderGeometry") continue;
    mesh.geometry.computeBoundingBox();
    const length = mesh.geometry.boundingBox!.max.y-mesh.geometry.boundingBox!.min.y;
    const bone = character.bones.find(b=>b.id===mesh.userData.boneId)!;
    expect(new Vector3(0,-length/2,0).applyMatrix4(mesh.matrixWorld).distanceTo(world[bone.startJointId].position)).toBeLessThan(1e-7);
    expect(new Vector3(0,length/2,0).applyMatrix4(mesh.matrixWorld).distanceTo(world[bone.endJointId].position)).toBeLessThan(1e-7);
  }
  expect(parts.some(m=>m.userData.jointId==="extra-left-thumb-3")).toBe(true);
  const editor = createSpatialScene(draft,{showRig:true});
  expect(editor.children[0].children).toHaveLength(parts.length);
  disposeSpatialScene(editor); disposeSpatialScene(model);
});

it("keeps palm geometry rigid during finger articulation and moves the head with neck length without resizing it", () => {
  const source = draftOf(actor(3));
  const posed = applySpatialOperations(source,[{type:"pose-hand",characterId:"p",handBoneId:"left-hand",curl:{thumb:.8,index:1,middle:.5}}]).draft;
  const palm = (a: SpatialCharacter) => meshes(a).find(m=>m.userData.boneId==="left-hand")!;
  expect(palm(posed.characters[0]).matrixWorld.elements).toEqual(palm(source.characters[0]).matrixWorld.elements);
  expect(palm(posed.characters[0]).geometry.attributes.position.array).toEqual(palm(source.characters[0]).geometry.attributes.position.array);
  const longer = applySpatialOperations(source,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:3,neckLength:1.4}]).draft;
  const before = meshes(source.characters[0]), after = meshes(longer.characters[0]);
  for (const id of ["spine","chest","head"]) {
    const a=before.find(m=>m.userData.boneId===id)!,b=after.find(m=>m.userData.boneId===id)!;
    expect(a.geometry.attributes.position.array).toEqual(b.geometry.attributes.position.array);
    if (id==="head") expect(b.position.y).toBeGreaterThan(a.position.y); else expect(b.position).toEqual(a.position);
  }
  const larger = applySpatialOperations(source,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:3,palmSize:1.3,footSize:1.4}]).draft;
  for (const side of ["left","right"]) {
    const a=before.find(m=>m.userData.boneId===`${side}-foot`)!,b=meshes(larger.characters[0]).find(m=>m.userData.boneId===`${side}-foot`)!;
    const boundsA=new Box3().setFromObject(a),boundsB=new Box3().setFromObject(b);
    expect(boundsB.getSize(new Vector3()).z).toBeGreaterThan(boundsA.getSize(new Vector3()).z);
    expect(boundsB.min.y).toBeCloseTo(boundsA.min.y,6);
  }
});

it("renders all camera and box reference passes from the geometric surface without changing the source", async () => {
  const draft = draftOf(), before=structuredClone(draft);
  const camera={...draft.cameras[0],width:128,height:128};
  const box={...fitSpatialCameraBox(createSpatialCameraBox("hands","Hands"),draft,"hands"),resolution:128};
  for (const pass of SPATIAL_RENDER_PASSES) {
    const png=await renderSpatialPng(draft,camera,pass);
    expect(await sharp(png).metadata()).toMatchObject({width:128,height:128});
    expect(png).not.toEqual(await renderSpatialPng({...draft,characters:[]},camera,pass));
    expect(await sharp(await renderSpatialCameraBoxPng(draft,box,"front",pass)).metadata()).toMatchObject({width:128,height:128});
  }
  expect(draft).toEqual(before);
});
