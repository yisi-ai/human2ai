import { describe, expect, it } from "vitest";
import { Box3, Mesh, Quaternion, Vector3 } from "three";
import { createHumanoid, createSpatialDraft, applySpatialOperations, jointWorldTransforms, validateSpatialDraft, type SpatialBodyType } from "../../src/domain/spatial/index.ts";
import { createSpatialScene, disposeSpatialScene } from "../../src/domain/spatial/scene.ts";
import { renderSpatialPng } from "../../src/server/spatial-render.ts";

const fixture=(bodyType: SpatialBodyType = "male")=>({...createSpatialDraft(),characters:[createHumanoid("p","Person",1.8,7,undefined,bodyType)]});
const triangles=(scene:ReturnType<typeof createSpatialScene>)=>{let n=0;scene.traverse(o=>{if(o instanceof Mesh)n+=(o.geometry.index?.count??o.geometry.getAttribute("position").count)/3;});return n;};
const meshPositions=(scene:ReturnType<typeof createSpatialScene>,boneId:string)=>{const values:number[]=[];scene.traverse(o=>{if(o instanceof Mesh&&o.userData.boneId===boneId)values.push(...o.geometry.getAttribute("position").array);});return values;};
describe("Quaternius appearance",()=>{
  it.each(["male","female"] as const)("skins each %s finger separately while retaining the shared hand surface", bodyType => {
    for (const heads of [2,3,7]) {
      const draft = applySpatialOperations(fixture(bodyType),[{type:"set-proportions",characterId:"p",height:1.8,headRatio:heads}]).draft;
      const posed = applySpatialOperations(draft,[{type:"pose-hand",characterId:"p",handBoneId:"left-hand",curl:{index:.7},thumbOpposition:.6}]).draft;
      const base = createSpatialScene(draft), next = createSpatialScene(posed), rig = createSpatialScene(posed,{showRig:true});
      try {
        expect(triangles(next)).toEqual(triangles(base));
        const values = meshPositions(next,"left-index-2");
        expect(values.length).toBeGreaterThan(100);
        expect(values.every(Number.isFinite)).toBe(true);
        expect(values).not.toEqual(meshPositions(base,"left-index-2"));
        expect(meshPositions(next,"right-index-2")).toEqual(meshPositions(base,"right-index-2"));
        expect(rig.children.some(o => o.userData.jointId === "left-index-3")).toBe(true);
        expect(rig.children.some(o => o.userData.rig === "bone" && o.userData.boneId === "left-index-0")).toBe(false);
      } finally {disposeSpatialScene(base);disposeSpatialScene(next);disposeSpatialScene(rig);}
    }
  });
  it.each(["male", "female"] as const)("coordinates %s low-count body volumes and keeps the taller silhouette and height",bodyType=>{
    const parts = ["spine","chest","left-elbow","left-wrist","left-hand","left-knee","left-ankle","left-foot"];
    const sizes = [2,4,7,10,12].map(headRatio => {
      const draft = applySpatialOperations(fixture(bodyType), [{type:"set-proportions",characterId:"p",height:1.8,headRatio}]).draft;
      const actor = draft.characters[0], world = jointWorldTransforms(actor), scene = createSpatialScene(draft);
      try {
        const dimensions: Record<string, Vector3> = {};
        for (const part of parts) {
          const bounds = new Box3();
          const bone = actor.bones.find(b => b.id === part)!;
          const start = world[bone.startJointId].position;
          const inverse = new Quaternion().setFromUnitVectors(new Vector3(0,1,0),world[bone.endJointId].position.clone().sub(start).normalize()).invert();
          scene.traverse(o=>{if(o instanceof Mesh && o.userData.modelPart===part) {
            const positions = o.geometry.getAttribute("position");
            for(let i=0;i<positions.count;i++) {
              const point = new Vector3().fromBufferAttribute(positions,i);
              expect(point.toArray().every(Number.isFinite)).toBe(true); bounds.expandByPoint(point.sub(start).applyQuaternion(inverse));
            }
          }});
          dimensions[part] = bounds.getSize(new Vector3());
        }
        expect(world.head.position.y).toBeCloseTo(1.8,10);
        expect(actor.bones).toEqual(fixture().characters[0].bones);
        return {dimensions, shoulders:world["left-shoulder"].position.distanceTo(world["right-shoulder"].position), hips:world["left-hip"].position.distanceTo(world["right-hip"].position)};
      } finally {disposeSpatialScene(scene);}
    });
    // Two heads needs a rounded body and substantial hands/feet, instead of
    // making every part monotonically thinner as the head becomes larger.
    expect(sizes[0].shoulders).toBeLessThan(sizes[2].shoulders * 1.05);
    expect(sizes[0].hips).toBeLessThan(sizes[2].hips * 1.05);
    for(const part of ["left-elbow", "left-wrist", "left-knee", "left-ankle"]) {
      expect(sizes[0].dimensions[part].z).toBeLessThan(sizes[2].dimensions[part].z);
    }
    for(let i=2;i<sizes.length;i++) {
      const [slim, wide] = i === 2 ? [sizes[i-1], sizes[i]] : [sizes[i], sizes[i-1]];
      expect(slim.shoulders).toBeLessThan(wide.shoulders);
      expect(slim.hips).toBeLessThan(wide.hips);
      for(const part of parts) for(const axis of ["x","z"] as const) {
        // Low-count torso depth now supports the head in profile independently
        // from its frontal width; taller figures retain the original curve.
        if (i === 2 && axis === "z" && ["spine", "chest"].includes(part)) continue;
        expect(slim.dimensions[part][axis]).toBeLessThan(wide.dimensions[part][axis]);
      }
    }
  });
  it("selects the real female source and restores male anatomy without resetting the pose",()=>{
    const old = fixture(); delete old.characters[0].bodyType;
    expect(validateSpatialDraft(old)).toEqual(old);
    const draft=applySpatialOperations(old,[{type:"rotate-bone",characterId:"p",boneId:"left-knee",rotation:[-78,0,5]}]).draft;
    const female=applySpatialOperations(draft,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:7,bodyType:"female"}]).draft;
    expect(female.characters[0].bodyType).toBe("female");
    expect(female.characters[0].bones).toEqual(draft.characters[0].bones);
    expect(female.characters[0].joints).not.toEqual(draft.characters[0].joints);
    const maleScene=createSpatialScene(draft),femaleScene=createSpatialScene(female);
    try {
      expect(triangles(femaleScene)).toBe(15060);
      expect(triangles(maleScene)).toBe(14318);
      expect(meshPositions(femaleScene,"head")).not.toEqual(meshPositions(maleScene,"head"));
    } finally {disposeSpatialScene(maleScene);disposeSpatialScene(femaleScene);}
    const restored=applySpatialOperations(female,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:7,bodyType:"male"}]).draft;
    expect(restored.characters[0].joints).toEqual(draft.characters[0].joints);
    expect(restored.characters[0].bones).toEqual(draft.characters[0].bones);
    const pinned=applySpatialOperations(draft,[{type:"lock-joint",characterId:"p",jointId:"left-wrist",position:true}]).draft;
    expect(()=>applySpatialOperations(pinned,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:7,bodyType:"female"}])).toThrow(/Fixed world position/);
    expect(()=>validateSpatialDraft({...female,characters:[{...female.characters[0],bodyType:"unknown"}]})).toThrow("SPATIAL_INVALID");
    const raw=structuredClone(draft); raw.characters[0].bodyType="female";
    expect(()=>validateSpatialDraft(raw)).toThrow(/anatomy/);
  });
  it("rejects retired appearance and draft formats without converting them",()=>{
    const draft=fixture();
    const retired={...draft,characters:draft.characters.map(c=>({...c,appearance:"skeleton"}))};
    expect(()=>validateSpatialDraft(retired)).toThrow("SPATIAL_INVALID");
    expect(()=>validateSpatialDraft({...draft,version:1})).toThrow("SPATIAL_INVALID");
    expect(()=>applySpatialOperations(draft,[{type:"put-character",character:retired.characters[0] as typeof draft.characters[0]}])).toThrow("invalid operations");
  });
  it("uses actual source mesh triangles, and duplicates mesh modules for arms and heads",()=>{
    const draft=fixture(),base=createSpatialScene(draft);
    const changed=applySpatialOperations(draft,[
      {type:"add-limb",characterId:"p",sourceJointId:"left-shoulder",parentId:"chest",idPrefix:"extra",offset:[.2,-.2,0]},
      {type:"add-limb",characterId:"p",sourceJointId:"neck",parentId:"chest",idPrefix:"second",offset:[-.2,.2,0]},
    ]).draft;
    const scene=createSpatialScene(changed);
    try {
      expect(triangles(base)).toBe(14318);
      expect(triangles(scene)).toBeGreaterThan(triangles(base)+1000);
      expect(meshPositions(scene,"extra-left-hand").length).toBeGreaterThan(100);
      expect(meshPositions(scene,"second-head").length).toBeGreaterThan(100);
      expect(meshPositions(scene,"left-hand")).toEqual(meshPositions(base,"left-hand"));
    } finally {disposeSpatialScene(base);disposeSpatialScene(scene);}
  });
  it("keeps custom limbs, poses and world pins when changing head proportions",()=>{
    const custom=applySpatialOperations(fixture(),[
      {type:"add-limb",characterId:"p",sourceJointId:"left-shoulder",parentId:"chest",idPrefix:"extra",offset:[.2,-.2,0]},
      {type:"add-limb",characterId:"p",sourceJointId:"neck",parentId:"chest",idPrefix:"second",offset:[-.2,.2,0]},
      {type:"rotate-bone",characterId:"p",boneId:"extra-left-elbow",rotation:[-30,0,-30]},
      {type:"lock-bone",characterId:"p",boneId:"extra-left-hand",rotation:true},
    ]).draft;
    const resized=applySpatialOperations(custom,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:4,bodyType:"female"}]).draft;
    expect(resized.characters[0].bodyType).toBe("female");
    expect(resized.characters[0].bones).toEqual(custom.characters[0].bones);
    const before=jointWorldTransforms(custom.characters[0]),after=jointWorldTransforms(resized.characters[0]);
    expect(after["extra-left-hand"].rotation.angleTo(before["extra-left-hand"].rotation)).toBeLessThan(1e-8);
    expect(after["second-head"].position.distanceTo(after["second-neck"].position)).toBeCloseTo(1.8/4,10);
    const scene=createSpatialScene(resized);
    try {
      expect(meshPositions(scene,"extra-left-hand").length).toBeGreaterThan(100);
      expect(meshPositions(scene,"second-head").every(Number.isFinite)).toBe(true);
    } finally {disposeSpatialScene(scene);}
    const pinned=applySpatialOperations(custom,[{type:"lock-joint",characterId:"p",jointId:"extra-left-hand",position:true}]).draft;
    const saved=structuredClone(pinned);
    expect(()=>applySpatialOperations(pinned,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:4}])).toThrow(/Fixed world position/);
    expect(pinned).toEqual(saved);
    const restored=applySpatialOperations(resized,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:7,bodyType:"male"}]).draft;
    expect(jointWorldTransforms(restored.characters[0])["extra-left-hand"].position.distanceTo(before["extra-left-hand"].position)).toBeLessThan(1e-8);
  });
  it("deforms the same geometry for the editor and deterministic camera PNG without leaking rig controls",async()=>{
    const draft=fixture();draft.cameras[0].width=256;draft.cameras[0].height=256;
    const changed=applySpatialOperations(draft,[{type:"set-proportions",characterId:"p",height:1.8,headRatio:4,bodyType:"female"},{type:"rotate-bone",characterId:"p",boneId:"left-elbow",rotation:[-30,0,-60]}]).draft;
    const base=createSpatialScene(draft),posed=createSpatialScene(changed),overlay=createSpatialScene(changed,{showRig:true});
    try {
      expect(meshPositions(posed,"left-elbow")).not.toEqual(meshPositions(base,"left-elbow"));
      const modelPositions:number[]=[];overlay.traverse(o=>{if(o instanceof Mesh&&o.userData.boneId==="left-elbow"&&!o.userData.rig)modelPositions.push(...o.geometry.getAttribute("position").array);});
      expect(modelPositions).toEqual(meshPositions(posed,"left-elbow"));
      expect(triangles(overlay)).toBeGreaterThan(triangles(posed));
      const a=await renderSpatialPng(draft,draft.cameras[0]),b=await renderSpatialPng(changed,changed.cameras[0]);
      expect(a).not.toEqual(b);expect(await renderSpatialPng(changed,changed.cameras[0])).toEqual(b);
    } finally {disposeSpatialScene(base);disposeSpatialScene(posed);disposeSpatialScene(overlay);}
  });
});
