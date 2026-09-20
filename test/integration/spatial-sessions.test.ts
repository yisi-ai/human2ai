import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createHuman2AiServer } from "../../src/server/runtime.js";
import { executeCli } from "../../src/cli/main.js";
import { applySpatialOperations, createHumanoid, createSpatialCameraBox, createSpatialDraft, jointWorldTransforms, type SpatialDraft } from "../../src/domain/spatial/index.js";
import { createDraft } from "../../src/domain/composition/index.js";
import { addCameraReference, snapshotCameraReference } from "../../src/domain/composition/camera-reference.js";
import { availableSpatialCameraPreviews, updateSpatialCameraPreviews } from "../../web/lib/spatial-camera-previews.ts";

describe("3D spatial sessions", () => {
  it("saves object notes through the CLI, exposes them in inspect and restores them without altering PNGs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "human2ai-spatial-notes-"));
    const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
    try {
      const session = (await server.inject({ method: "POST", url: "/api/v1/sessions", payload: { sessionType: "spatial", title: "Object notes" } })).json<{ id: string }>();
      const root = `/api/v1/sessions/${session.id}/spatial`, draft = createSpatialDraft();
      draft.characters = [createHumanoid("person", "Person")];
      draft.objects = [{ id: "desk", name: "Desk", kind: "box", position: [1, .5, 0], rotation: [0, 0, 0], size: [1, 1, 1], color: "#abcdef" }];
      draft.cameraBoxes = [createSpatialCameraBox("box", "Observation box")];
      draft.cameras[0].width = draft.cameras[0].height = 128;
      expect((await server.inject({ method: "POST", url: `${root}/drafts`, payload: { expectedLatestRevision: 0, draft } })).statusCode).toBe(201);
      const loaded = (await server.inject(`${root}/drafts/latest`)).json<{ draftVersion: { draft: SpatialDraft } }>().draftVersion.draft;
      const previews = updateSpatialCameraPreviews(undefined, loaded, 1);
      const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const response = await server.inject({ method: (init?.method ?? "GET") as "GET", url: url.pathname + url.search, payload: init?.body as string | undefined, headers: init?.headers as Record<string, string> });
        return new Response(new Uint8Array(response.rawPayload), { status: response.statusCode, headers: { "content-type": String(response.headers["content-type"]) } });
      };
      const note = "保持当前位置\n依据空间风格细化，不照搬占位形状。", input = join(directory, "notes.json");
      await writeFile(input, JSON.stringify([
        { type: "put-character", character: { ...draft.characters[0], note } },
        { type: "put-object", object: { ...draft.objects[0], name: "Reception desk", note } },
        { type: "put-camera", camera: { ...draft.cameras[0], note } },
        { type: "put-camera-box", box: { ...draft.cameraBoxes[0], note } },
      ]));
      const applied = await executeCli(["spatial", "apply", "--session", session.id, "--revision", "1", "--input", input], { fetch: fetcher as typeof fetch }) as { draft: SpatialDraft; revision: number };
      expect([...availableSpatialCameraPreviews(previews, applied.draft)]).toEqual([["camera-1", 1]]);
      const savedPreviews = updateSpatialCameraPreviews(previews, applied.draft, applied.revision);
      const inspected = await executeCli(["spatial", "inspect", "--session", session.id, "--revision", "2"], { fetch: fetcher as typeof fetch }) as { draft: SpatialDraft };
      for (const entity of [...inspected.draft.characters, ...inspected.draft.objects, ...inspected.draft.cameras, ...inspected.draft.cameraBoxes!]) expect(entity.note).toBe(note);
      expect(inspected.draft.objects[0].name).toBe("Reception desk");
      expect((await server.inject(`${root}/drafts/1`)).json().draft).toEqual(draft);
      const png = (revision: number) => server.inject(`${root}/cameras/camera-1.png?revision=${revision}`);
      const before = await png(1), after = await png(2);
      expect(before.statusCode).toBe(200); expect(after.statusCode).toBe(200);
      expect(after.rawPayload.equals(before.rawPayload)).toBe(true);
      const undo = await server.inject({ method: "POST", url: `${root}/drafts/undo`, payload: { expectedLatestRevision: 2, changeRevision: 2 } });
      expect(undo.statusCode).toBe(201); expect(undo.json().draft).toEqual(draft);
      const restored = await server.inject({ method: "POST", url: `${root}/drafts/restore`, payload: { expectedLatestRevision: 3, targetRevision: 2 } });
      expect(restored.statusCode).toBe(201); expect(restored.json().draft).toEqual(inspected.draft);
      expect([...availableSpatialCameraPreviews(savedPreviews, undo.json().draft)]).toEqual([["camera-1", 1]]);
      expect([...availableSpatialCameraPreviews(savedPreviews, restored.json().draft)]).toEqual([["camera-1", 1]]);
    } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
  });

  it("keeps existing connector poses rigid across API edits, raw saves, reset and undo", async () => {
    const directory = await mkdtemp(join(tmpdir(),"human2ai-connectors-"));
    const server = createHuman2AiServer({databasePath:":memory:",artifactsDirectory:directory});
    try {
      const session = (await server.inject({method:"POST",url:"/api/v1/sessions",payload:{sessionType:"spatial",title:"Connectors"}})).json<{id:string}>();
      const root = `/api/v1/sessions/${session.id}/spatial`, draft = {...createSpatialDraft(),characters:[createHumanoid("p","Person")]};
      const bone = draft.characters[0].bones.find(b => b.id === "left-shoulder")!;
      bone.rotation = [10,-5,15]; bone.limits = {min:[-30,-30,-30],max:[30,30,30]};
      expect((await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:0,draft}})).statusCode).toBe(201);
      const blocked = await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:1,operations:[{type:"rotate-bone",characterId:"p",boneId:bone.id,rotation:[20,20,20]}]}});
      expect(blocked.statusCode).toBe(201); expect(blocked.json().constrained).toBe(true); expect(blocked.json().draft).toEqual(draft);
      const changed = structuredClone(draft); changed.characters[0].bones.find(b => b.id === bone.id)!.rotation[0] = 20;
      const raw = await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:2,draft:changed}});
      expect(raw.statusCode).toBe(400); expect(raw.json().message).toContain("Rigid connector rotation changed");
      const limits = await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:2,operations:[{type:"set-bone-limits",characterId:"p",boneId:bone.id,limits:{min:[-90,-90,-90],max:[90,90,90]}}]}});
      expect(limits.statusCode).toBe(422); expect(limits.json().code).toBe("SPATIAL_CONSTRAINT");
      const reset = await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:2,operations:[{type:"reset-pose",characterId:"p"}]}});
      expect(reset.statusCode).toBe(201); expect(reset.json().revision).toBe(3);
      expect(reset.json().draft.characters[0].bones.find((b:{id:string}) => b.id === bone.id).rotation).toEqual([0,0,0]);
      const undo = await server.inject({method:"POST",url:`${root}/drafts/undo`,payload:{expectedLatestRevision:3,changeRevision:3}});
      expect(undo.statusCode).toBe(201); expect(undo.json().draft).toEqual(draft);
      expect((await server.inject(`${root}/drafts/1`)).json().draft).toEqual(draft);
    } finally { await server.close(); await rm(directory,{recursive:true,force:true}); }
  });

  it("persists scene lighting through Agent operations, versioned camera PNGs and undo", async () => {
    const directory = await mkdtemp(join(tmpdir(),"human2ai-lighting-"));
    const server = createHuman2AiServer({databasePath:":memory:",artifactsDirectory:directory});
    try {
      const session = (await server.inject({method:"POST",url:"/api/v1/sessions",payload:{sessionType:"spatial",title:"Lighting"}})).json<{id:string}>();
      const root = `/api/v1/sessions/${session.id}/spatial`, draft = createSpatialDraft();
      delete draft.lightingEnabled;
      draft.objects = [{id:"box",name:"Box",kind:"box",position:[0,0,0],rotation:[0,0,0],size:[1,1,1],color:"#aaaaaa"}];
      draft.cameras = [1,-1].map((side,index)=>({...draft.cameras[0],id:`camera-${index}`,position:[0,2,side*5],target:[0,0,0],width:128,height:128}));
      expect((await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:0,draft}})).statusCode).toBe(201);
      const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const response = await server.inject({method:(init?.method??"GET") as "GET",url:url.pathname+url.search,payload:init?.body as string|undefined,headers:init?.headers as Record<string,string>});
        return new Response(new Uint8Array(response.rawPayload),{status:response.statusCode,headers:{"content-type":String(response.headers["content-type"])}});
      };
      const methods = await executeCli(["spatial","methods"],{fetch:fetcher as typeof fetch}) as {operations:string[]};
      expect(methods.operations).toContain("set-lighting");
      const input = join(directory,"lighting.json"); await writeFile(input,JSON.stringify([{type:"set-lighting",enabled:true}]));
      await executeCli(["spatial","apply","--session",session.id,"--revision","1","--input",input],{fetch:fetcher as typeof fetch});
      const saved = (await server.inject(`${root}/drafts/2`)).json<{draft:SpatialDraft}>();
      expect(saved.draft).toEqual({...draft,lightingEnabled:true});
      for (const camera of draft.cameras) {
        const png = (revision:number,pass="color")=>server.inject(`${root}/cameras/${camera.id}.png?revision=${revision}&pass=${pass}`);
        const bright = await png(1), lit = await png(2);
        expect(bright.statusCode).toBe(200); expect(lit.statusCode).toBe(200);
        expect(bright.rawPayload.equals(lit.rawPayload)).toBe(false);
        for (const pass of ["structure","depth"]) expect((await png(1,pass)).rawPayload.equals((await png(2,pass)).rawPayload)).toBe(true);
        expect((await png(1)).rawPayload.equals(bright.rawPayload)).toBe(true);
      }
      expect((await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:2,operations:[{type:"set-lighting",enabled:"false"}]}})).statusCode).toBe(400);
      const undo = await server.inject({method:"POST",url:`${root}/drafts/undo`,payload:{expectedLatestRevision:2,changeRevision:2}});
      expect(undo.statusCode).toBe(201); expect(undo.json().draft).toEqual(draft);
      const output = join(directory,"restored.png");
      await executeCli(["spatial","render","--session",session.id,"--revision","3","--camera","camera-1","--output",output],{fetch:fetcher as typeof fetch});
      expect((await readFile(output)).equals((await server.inject(`${root}/cameras/camera-1.png?revision=1`)).rawPayload)).toBe(true);
    } finally { await server.close(); await rm(directory,{recursive:true,force:true}); }
  });

  it("creates, edits, renders and undoes a multi-camera scene through shared capture and Agent APIs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "human2ai-spatial-"));
    const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
    try {
      const session = (await server.inject({ method: "POST", url: "/api/v1/sessions", payload: { sessionType: "spatial", title: "四臂角色" } })).json<{ id: string }>();
      expect(session.id).toBeTruthy();
      const root = `/api/v1/sessions/${session.id}/spatial`;
      expect((await server.inject({ method: "POST", url: `${root}/drafts`, payload: { expectedLatestRevision: 0, draft: createSpatialDraft() } })).statusCode).toBe(201);
      const edit = await server.inject({ method: "POST", url: `${root}/operations`, payload: { expectedLatestRevision: 1, operations: [
        { type: "add-character", id: "actor", name: "Creature", torsoRatio: 0.3, bodyType: "female", neckLength: .8, palmSize: 1.2, fingerLength: 1.4, footSize: .7 },
        { type: "add-limb", characterId: "actor", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "lower-left", offset: [0.2, -0.2, 0] },
        { type: "add-limb", characterId: "actor", sourceJointId: "right-shoulder", parentId: "chest", idPrefix: "lower-right", offset: [-0.2, -0.2, 0] },
        { type: "pose-hand", characterId: "actor", handBoneId: "lower-left-left-hand", curl: { index: .8, middle: .6 }, thumbOpposition: .5 },
        { type: "rotate-bone", characterId: "actor", boneId: "lower-left-left-thumb-2", rotation: [0,0,-20] },
        { type: "rotate-bone", characterId: "actor", boneId: "lower-left-left-thumb-3", rotation: [0,0,-45] },
        { type: "set-proportions", characterId: "actor", height: 1.8, headRatio: 3, neckLength: 1.2 },
        { type: "put-camera", camera: { ...createSpatialDraft().cameras[0], id: "camera-side", position: [4, 1, 0], width: 256, height: 256 } },
      ] } });
      expect(edit.statusCode, edit.body).toBe(201);
      const changed = edit.json<{ revision: number; draft: SpatialDraft }>();
      expect(changed.revision).toBe(2);
      expect(changed.draft.characters[0].joints).toHaveLength(109);
      expect(changed.draft.characters[0].torsoRatio).toBe(.3);
      expect(changed.draft.characters[0].bodyType).toBe("female");
      expect(changed.draft.characters[0]).toMatchObject({ neckLength: 1.2, palmSize: 1.2, fingerLength: 1.4, footSize: .7 });
      expect(changed.draft.characters[0].bones.find(b => b.id === "lower-left-left-index-1")!.rotation[0]).toBe(56);
      expect(changed.draft.characters[0].bones.find(b => b.id === "lower-left-left-thumb-3")!.rotation[2]).toBeCloseTo(-45,6);
      const png = await server.inject(`${root}/cameras/camera-side.png?revision=2`);
      expect(png.statusCode).toBe(200);
      const meta = await sharp(png.rawPayload).metadata();
      expect(meta).toMatchObject({ format: "png", width: 256, height: 256, hasAlpha: true });
      const { data } = await sharp(png.rawPayload).raw().toBuffer({ resolveWithObject: true });
      const alpha = Array.from(data).filter((_, i) => i % 4 === 3);
      expect(alpha.some(v => v > 0)).toBe(true);
      expect(alpha.some(v => v === 0)).toBe(true);
      expect((await server.inject({ method: "POST", url: `${root}/operations`, payload: { expectedLatestRevision: 1, operations: [] } })).statusCode).toBe(409);
      const undo = await server.inject({ method: "POST", url: `${root}/drafts/undo`, payload: { expectedLatestRevision: 2, changeRevision: 2 } });
      expect(undo.statusCode).toBe(201);
      expect(undo.json().draft.characters).toEqual([]);
      expect((await server.inject(`${root}/cameras/camera-side.png`)).statusCode).toBe(404);
      expect((await server.inject(`${root}/cameras/camera-side.png?revision=2`)).rawPayload).toEqual(png.rawPayload);
      const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const result = await server.inject({ method: (init?.method ?? "GET") as "GET", url: url.pathname + url.search, payload: init?.body as string | undefined, headers: init?.headers as Record<string, string> });
        return new Response(new Uint8Array(result.rawPayload), { status: result.statusCode, headers: { "content-type": String(result.headers["content-type"]) } });
      };
      const connection = await executeCli(["session", "connect", "--session", session.id], { fetch: fetcher as typeof fetch });
      expect(JSON.stringify(connection)).toContain("spatial-draft");
      expect(JSON.stringify(connection)).toContain("spatial.apply@1");
      const methods = await executeCli(["spatial","methods"], { fetch: fetcher as typeof fetch }) as { operations: string[] };
      expect(methods.operations).toContain("pose-hand");
      expect(methods.operations).toContain("reset-hand");
      for (const key of ["neckLength","palmSize","fingerLength","footSize"]) expect(JSON.stringify(methods)).toContain(`"${key}"`);
      const inspection = await executeCli(["spatial", "inspect", "--session", session.id, "--revision", "2"], { fetch: fetcher as typeof fetch }) as { draft: SpatialDraft; characters: { joints: { worldPosition: number[] }[] }[] };
      expect(inspection.draft.characters[0]).toMatchObject({ neckLength: 1.2, palmSize: 1.2, fingerLength: 1.4, footSize: .7 });
      expect(inspection.characters[0].joints).toHaveLength(109);
      expect(inspection.characters[0].joints[0].worldPosition).toEqual(jointWorldTransforms(changed.draft.characters[0]).pelvis.position.toArray());
      const output = join(directory, "side.png");
      await executeCli(["spatial", "render", "--session", session.id, "--revision", "2", "--camera", "camera-side", "--output", output], { fetch: fetcher as typeof fetch });
      expect(await readFile(output)).toEqual(png.rawPayload);
      const versionsBeforeReferences = (await server.inject(`${root}/drafts`)).body;
      for (const pass of ["color", "structure", "depth", "skeleton"]) {
        const reference = await server.inject(`${root}/cameras/camera-side.png?revision=2&pass=${pass}`);
        expect(reference.statusCode).toBe(200);
        expect(reference.headers["x-spatial-render-pass"]).toBe(pass);
        expect(reference.headers["x-spatial-revision"]).toBe("2");
        expect(await sharp(reference.rawPayload).metadata()).toMatchObject({ format: "png", width: 256, height: 256 });
        if (pass === "color") expect(reference.rawPayload).toEqual(png.rawPayload);
        else expect(reference.rawPayload).not.toEqual(png.rawPayload);
        await executeCli(["spatial", "render", "--session", session.id, "--revision", "2", "--camera", "camera-side", "--pass", pass, "--output", output], { fetch: fetcher as typeof fetch });
        expect(await readFile(output)).toEqual(reference.rawPayload);
        expect((await server.inject(`${root}/cameras/camera-side.png?revision=2&pass=${pass}`)).rawPayload).toEqual(reference.rawPayload);
      }
      expect((await server.inject(`${root}/drafts`)).body).toBe(versionsBeforeReferences);
      expect((await server.inject(`${root}/cameras/camera-side.png?revision=2&pass=unknown`)).statusCode).toBe(400);
      await expect(executeCli(["spatial", "render", "--session", session.id, "--revision", "2", "--camera", "camera-side", "--pass", "unknown", "--output", output], { fetch: fetcher as typeof fetch })).rejects.toThrow(/--pass/);

      // Composition owns the PNG independently of the source space and embeds
      // it in Agent previews instead of replacing the reference with a box.
      const composition = (await server.inject({ method: "POST", url: "/api/v1/sessions", payload: { sessionType: "image-composition", title: "Camera reference" } })).json<{ id: string }>();
      const asset = (await server.inject({ method: "POST", url: `/api/v1/sessions/${composition.id}/assets?filename=side.png`, headers: { "content-type": "application/octet-stream" }, payload: png.rawPayload })).json<{ id: string }>();
      const reference = addCameraReference(createDraft(), { sessionId: session.id, cameraId: "camera-side", revision: 2, assetId: asset.id, width: 256, height: 256 });
      const snapshot = snapshotCameraReference(reference.draft, reference.id);
      expect((await server.inject({ method: "POST", url: `/api/v1/sessions/${composition.id}/composition/drafts`, payload: { expectedLatestRevision: 0, draft: snapshot.draft } })).statusCode).toBe(201);
      const preview = join(directory, "composition.svg");
      await executeCli(["composition", "inspect", "--session", composition.id, "--revision", "1", "--preview", preview], { fetch: fetcher as typeof fetch });
      expect(await readFile(preview, "utf8")).toContain(`data:image/png;base64,${png.rawPayload.toString("base64")}`);
      const metadata = (await server.inject(`/api/v1/sessions/${session.id}`)).json();
      expect((await server.inject({ method: "DELETE", url: `/api/v1/sessions/${session.id}`, payload: { expectedRevision: metadata.revision } })).statusCode).toBe(204);
      expect((await server.inject(`/api/v1/sessions/${composition.id}/assets/${asset.id}/content`)).rawPayload).toEqual(png.rawPayload);
      const retained = (await server.inject(`/api/v1/sessions/${composition.id}/composition/drafts/1`)).json().draft.images;
      expect(retained[0].cameraReference.sessionId).toBe(session.id);
      expect(retained[1].cameraReference).toBeUndefined();
    } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
  });

  it("validates Agent batches atomically, retains pins on raw saves and makes initial authoring undoable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "human2ai-spatial-batch-"));
    const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
    try {
      const session = (await server.inject({ method: "POST", url: "/api/v1/sessions", payload: { sessionType: "spatial", title: "Pins" } })).json<{ id: string }>();
      const root = `/api/v1/sessions/${session.id}/spatial`;
      const post = (revision: number, operations: unknown[]) => server.inject({ method: "POST", url: `${root}/operations`, payload: { expectedLatestRevision: revision, operations } });
      expect((await post(0, [{ type: "add-character", id: "p", name: "Person" }, { type: "put-camera" }])).statusCode).toBe(400);
      expect((await server.inject(`${root}/drafts`)).json().draftVersions).toEqual([]);
      const file = join(directory, "operations.json");
      await writeFile(file, JSON.stringify([{ type: "add-character", id: "p", name: "Person" }, { type: "lock-joint", characterId: "p", jointId: "left-hand", position: true }]));
      const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
        const result = await server.inject({ method: (init?.method ?? "GET") as "GET", url: new URL(String(input)).pathname, payload: init?.body as string | undefined, headers: init?.headers as Record<string, string> });
        return new Response(result.body, { status: result.statusCode, headers: { "content-type": "application/json" } });
      };
      const created = await executeCli(["spatial", "apply", "--session", session.id, "--revision", "0", "--input", file], { fetch: fetcher as typeof fetch }) as { revision: number; draft: SpatialDraft };
      expect(created.revision).toBe(2);
      const initialUndo = await server.inject({ method: "POST", url: `${root}/drafts/undo`, payload: { expectedLatestRevision: 2, changeRevision: 2 } });
      expect(initialUndo.statusCode).toBe(201);
      expect(initialUndo.json().draft.characters).toEqual([]);
      expect((await server.inject({ method: "POST", url: `${root}/drafts`, payload: { expectedLatestRevision: 3, draft: created.draft } })).statusCode).toBe(201);
      const invalid = structuredClone(created.draft); invalid.characters[0].position[0] += 1;
      expect((await server.inject({ method: "POST", url: `${root}/drafts`, payload: { expectedLatestRevision: 4, draft: invalid } })).statusCode).toBe(400);
      expect((await post(4, [{ type: "put-character", character: invalid.characters[0] }])).statusCode).toBe(422);
      expect((await post(4, [
        { type: "lock-joint", characterId: "p", jointId: "left-hand", position: false },
        { type: "move-joint", characterId: "p", jointId: "left-hand", position: [0.6, 1.3, 0.3] },
        { type: "lock-joint", characterId: "p", jointId: "left-hand", position: true },
      ])).statusCode).toBe(201);
      expect((await server.inject(`${root}/drafts`)).json().draftVersions).toHaveLength(5);
      const undo = await server.inject({ method: "POST", url: `${root}/drafts/undo`, payload: { expectedLatestRevision: 5, changeRevision: 5 } });
      expect(undo.statusCode).toBe(201);
      expect(undo.json().draft).toEqual(created.draft);
    } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
  });
  it("restores the current model pose with a single undoable revision", async () => {
    const directory=await mkdtemp(join(tmpdir(),"spatial-restore-"));
    const server=createHuman2AiServer({databasePath:":memory:",artifactsDirectory:directory});
    try {
      const session=(await server.inject({method:"POST",url:"/api/v1/sessions",payload:{sessionType:"spatial",title:"Reset"}})).json();
      const root=`/api/v1/sessions/${session.id}/spatial`;
      const draft=applySpatialOperations({...createSpatialDraft(),characters:[createHumanoid("p","Person")]},[
        {type:"rotate-bone",characterId:"p",boneId:"left-elbow",rotation:[-30,0,-60]},
        {type:"lock-joint",characterId:"p",jointId:"left-wrist",position:true},
        {type:"lock-bone",characterId:"p",boneId:"left-hand",rotation:true},
      ]).draft;
      expect((await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:0,draft:{...draft,version:1}}})).statusCode).toBe(400);
      const saved=await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:0,draft}});
      expect(saved.statusCode,saved.body).toBe(201);
      expect(saved.json().draft.version).toBe(2);
      const blocked=await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:1,operations:[{type:"set-proportions",characterId:"p",height:1.8,headRatio:7,torsoRatio:.3}]}});
      expect(blocked.statusCode).toBe(422);
      expect((await server.inject(`${root}/drafts`)).json().draftVersions).toHaveLength(1);
      const reset=await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:1,operations:[{type:"reset-pose",characterId:"p"}]}});
      expect(reset.statusCode,reset.body).toBe(201);expect(reset.json().revision).toBe(2);
      expect(reset.json().draft.characters[0].joints.every((j:{lockPosition:boolean})=>!j.lockPosition)).toBe(true);
      expect(reset.json().draft.characters[0].bones.every((b:{lockRotation:boolean;rotation:number[]})=>!b.lockRotation&&b.rotation.every(v=>v===0))).toBe(true);
      const undo=await server.inject({method:"POST",url:`${root}/drafts/undo`,payload:{expectedLatestRevision:2,changeRevision:2}});
      expect(undo.statusCode,undo.body).toBe(201);expect(undo.json().draft).toEqual(saved.json().draft);
      const proportions=await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:3,operations:[
        {type:"lock-joint",characterId:"p",jointId:"left-wrist",position:false},
        {type:"set-proportions",characterId:"p",height:1.8,headRatio:7,torsoRatio:.3,bodyType:"female"},
      ]}});
      expect(proportions.statusCode,proportions.body).toBe(201);
      expect(proportions.json().draft.characters[0].torsoRatio).toBe(.3);
      expect(proportions.json().draft.characters[0].bodyType).toBe("female");
      const invalid=structuredClone(proportions.json().draft);invalid.characters[0].torsoRatio=.8;
      expect((await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:4,draft:invalid}})).statusCode).toBe(400);
      const revert=await server.inject({method:"POST",url:`${root}/drafts/undo`,payload:{expectedLatestRevision:4,changeRevision:4}});
      expect(revert.statusCode,revert.body).toBe(201);expect(revert.json().draft).toEqual(saved.json().draft);
    } finally {await server.close();await rm(directory,{recursive:true,force:true});}
  });

});
