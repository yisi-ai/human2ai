import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { Vector3 } from "three";
import { applySpatialOperations, cameraBoxView, createHumanoid, createSpatialCameraBox, createSpatialDraft, fitSpatialCameraBox, quaternion, SPATIAL_BOX_FACES, validateSpatialDraft, type SpatialCameraBox, type Vec3 } from "../../src/domain/spatial/index.ts";
import { renderSpatialCameraBoxPng } from "../../src/server/spatial-render.ts";

const box: SpatialCameraBox = { ...createSpatialCameraBox("views", "Views"), position: [0,0,0], size: 2, resolution: 128 };
describe("inward camera boxes", () => {
  it("persists a separate bounded object without touching pose or the main camera", () => {
    const draft = createSpatialDraft();
    const added = applySpatialOperations(draft,[{type:"put-camera-box",box}]).draft;
    expect(draft.cameraBoxes).toBeUndefined();
    expect(added.cameras).toEqual(draft.cameras);
    expect(added.cameraBoxes).toEqual([box]);
    expect(applySpatialOperations(added,[{type:"remove",id:box.id}]).draft.cameraBoxes).toEqual([]);
    expect(() => applySpatialOperations(draft,[{type:"put-camera-box",box:{...box,id:draft.cameras[0].id}}])).toThrow(/duplicate/);
    for (const patch of [{size:0},{size:1001},{resolution:127},{resolution:1025},{resolution:128.5}]) {
      expect(() => validateSpatialDraft({...draft,cameraBoxes:[{...box,...patch}]})).toThrow();
    }
    expect(() => applySpatialOperations(draft,[{type:"fit-camera-box",id:"missing",region:"hands"}])).toThrow(/not found/);
  });

  it.each(SPATIAL_BOX_FACES)("%s camera clips precisely the rotated cube and looks toward its center", face => {
    const rotated = {...box,position:[4,-2,7] as Vec3,rotation:[25,60,-35] as Vec3};
    const {camera} = cameraBoxView(rotated,face), rotation = quaternion(rotated.rotation);
    expect(camera.getWorldDirection(new Vector3()).dot(new Vector3(...rotated.position).sub(camera.position).normalize())).toBeCloseTo(1,9);
    const center = new Vector3(...rotated.position).project(camera);
    expect(center.length()).toBeLessThan(1e-10);
    for (const local of [[.8,.7,-.9],[-.7,.8,.9],[1.2,0,0],[0,-1.2,0],[0,0,1.2]]) {
      const projected = new Vector3(...local).applyQuaternion(rotation).add(new Vector3(...rotated.position)).project(camera);
      const inside = [projected.x,projected.y,projected.z].every(value=>Math.abs(value)<1);
      expect(inside).toBe(local.every(value=>Math.abs(value)<1));
    }
    // For every face the camera's declared up projects vertically, without a mirrored image.
    const up = new Vector3(...rotated.position).addScaledVector(camera.up,.5).project(camera);
    expect(up.x).toBeCloseTo(0,9); expect(up.y).toBeCloseTo(.5,9);
    if (face === "top" || face === "bottom") expect(camera.up.clone().applyQuaternion(rotation.clone().invert()).z).toBe(face === "top" ? -1 : 1);
  });

  it("fits posed mesh bounds and all hands while retaining authored rotation and anatomy", () => {
    const draft = {...createSpatialDraft(),characters:[createHumanoid("p","Person")]}, before = structuredClone(draft);
    const rotated = {...box,rotation:[0,30,0] as Vec3};
    const whole = fitSpatialCameraBox(rotated,draft,"scene"), hands = fitSpatialCameraBox(rotated,draft,"hands");
    expect(whole.size).toBeGreaterThan(1.8);
    expect(hands.size).toBeLessThan(whole.size);
    expect(hands.rotation).toEqual(rotated.rotation);
    expect(draft).toEqual(before);
    expect(fitSpatialCameraBox(box,createSpatialDraft(),"hands")).toEqual(box);
  });

  it("excludes external occluders on all six faces, retains transparency, and composes exact tiles", async () => {
    const draft = createSpatialDraft();
    draft.objects = [{id:"inside",name:"Inside",kind:"box",position:[0,0,0],rotation:[0,0,0],size:[.4,.6,.8],color:"#ff0000"}];
    const faces = [];
    for (const face of SPATIAL_BOX_FACES) {
      const png = await renderSpatialCameraBoxPng(draft,box,face);
      const {camera} = cameraBoxView(box,face);
      const outside = {...draft,objects:[...draft.objects,{...draft.objects[0],id:"outside",position:camera.position.clone().multiplyScalar(3).toArray() as Vec3,size:[1,1,1] as Vec3,color:"#0000ff"}]};
      expect(await renderSpatialCameraBoxPng(outside,box,face)).toEqual(png);
      const raw = await sharp(png).raw().toBuffer();
      expect(raw[3]).toBe(0);
      expect(raw[(64*128+64)*4]).toBeGreaterThan(100);
      expect(raw[(64*128+64)*4+2]).toBe(0);
      faces.push(png);
    }
    const sheet = await renderSpatialCameraBoxPng(draft,box);
    expect(await sharp(sheet).metadata()).toMatchObject({width:408,height:324,hasAlpha:true});
    for (let i=0;i<6;i++) {
      const tile = await sharp(sheet).extract({left:i%3*140,top:Math.floor(i/3)*168+28,width:128,height:128}).raw().toBuffer();
      expect(tile).toEqual(await sharp(faces[i]).raw().toBuffer());
    }
    const depth = await sharp(await renderSpatialCameraBoxPng(draft,box,"front","depth")).raw().toBuffer();
    expect(depth[0]).toBe(0);
    expect(depth[(64*128+64)*4]).toBeCloseTo(179,0); // Surface z=.4, .6 m from the near face of a 2 m cube.
  });
});
