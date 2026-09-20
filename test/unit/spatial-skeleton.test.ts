import { expect, it } from "vitest";
import sharp from "sharp";
import { createHumanoid, createSpatialCameraBox, createSpatialDraft, jointWorldTransforms, type SpatialCamera, type SpatialCharacter } from "../../src/domain/spatial/index.ts";
import { createOutputCamera } from "../../src/domain/spatial/scene.ts";
import { renderSpatialPng, renderSpatialCameraBoxPng } from "../../src/server/spatial-render.ts";

it.each(["perspective","orthographic"] as const)("projects actual joints and fingertips through a %s camera, independent of skin or scene lighting", async projection => {
  const draft = {...createSpatialDraft(),characters:[createHumanoid("p","Person")]};
  const source: SpatialCamera = {...draft.cameras[0],position:[0,.9,4],target:[0,.9,0],projection,span:2.4,width:512,height:384};
  const before = structuredClone(draft), png = await renderSpatialPng(draft,source,"skeleton");
  expect(await sharp(png).metadata()).toMatchObject({width:512,height:384});
  const {data,info} = await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const world = jointWorldTransforms(draft.characters[0]), camera = createOutputCamera(source);
  for (const id of ["left-index-3","right-thumb-3","left-wrist","right-ankle"]) {
    const p = world[id].position.clone().project(camera), x = Math.round((p.x+1)*info.width/2), y = Math.round((1-p.y)*info.height/2);
    let colored = false;
    for (let dy=-4;dy<=4;dy++) for (let dx=-4;dx<=4;dx++) {
      const i=((y+dy)*info.width+x+dx)*3;
      if (id.startsWith("left") ? data[i+2]>data[i]+20 : data[i]>data[i+2]+20) colored=true;
    }
    expect(colored,id).toBe(true);
  }
  const occluder = {...draft,lightingEnabled:true,objects:[{id:"wall",name:"Wall",kind:"box" as const,position:[0,1,2] as [number,number,number],rotation:[0,0,0] as [number,number,number],size:[10,10,1] as [number,number,number],color:"#00ff00"}]};
  occluder.characters = [{...draft.characters[0],color:"#ff00ff"}];
  expect(await renderSpatialPng(occluder,{...source,background:"#000000"},"skeleton")).toEqual(png);
  expect(draft).toEqual(before);
});

it("excludes characters behind the camera or outside its frame and returns a clear empty image", async () => {
  const draft = createSpatialDraft(), camera: SpatialCamera = {...draft.cameras[0],position:[0,1,4],target:[0,1,0],width:128,height:128};
  const empty = await renderSpatialPng(draft,camera,"skeleton");
  for (const position of [[0,0,10],[100,0,0]] as [number,number,number][]) {
    expect(await renderSpatialPng({...draft,characters:[{...createHumanoid("p","Person"),position}]},camera,"skeleton")).toEqual(empty);
  }
  expect(new Set(await sharp(empty).removeAlpha().raw().toBuffer())).toEqual(new Set([250]));
});

it("clips a crossing bone to the observation volume and exports exact skeleton tiles in the six-view sheet", async () => {
  const actor: SpatialCharacter = {...createHumanoid("p","Person"),kind:"custom",position:[-2,0,0],joints:[
    {id:"root",name:"Root",parentId:null,offset:[0,0,0],lockPosition:false,radius:.01,terminal:false},
    {id:"tip",name:"Tip",parentId:"root",offset:[4,0,0],lockPosition:false,radius:.01,terminal:true},
  ],bones:[{id:"bone",name:"Bone",startJointId:"root",endJointId:"tip",rotation:[0,0,0],restRotation:[0,0,0],limits:{min:[-90,-90,-90],max:[90,90,90]},lockRotation:false,modelPart:"left-custom"}]};
  const draft = {...createSpatialDraft(),characters:[actor]}, box = {...createSpatialCameraBox("six","Six"),position:[0,0,0] as [number,number,number],size:1,resolution:128};
  const face = await renderSpatialCameraBoxPng(draft,box,"front","skeleton");
  const raw = await sharp(face).removeAlpha().raw().toBuffer();
  for (const x of [0,64,127]) {
    const pixel = (64*128+x)*3;
    expect(raw[pixel+2]).toBeGreaterThan(raw[pixel]+20);
  }
  const sheet = await renderSpatialCameraBoxPng(draft,box,"sheet","skeleton");
  expect(await sharp(sheet).extract({left:0,top:28,width:128,height:128}).removeAlpha().raw().toBuffer()).toEqual(raw);
  const outside = {...draft,characters:[{...actor,position:[-2,3,0] as [number,number,number]}]};
  expect(await renderSpatialCameraBoxPng(outside,box,"front","skeleton")).toEqual(await renderSpatialCameraBoxPng(createSpatialDraft(),box,"front","skeleton"));
});
