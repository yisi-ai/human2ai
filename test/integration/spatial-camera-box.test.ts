import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";
import { createHuman2AiServer } from "../../src/server/runtime.ts";
import { executeCli } from "../../src/cli/main.ts";
import { createSpatialCameraBox, createSpatialDraft } from "../../src/domain/spatial/index.ts";

it("exposes camera boxes to Agent CLI, saves atomically, renders pinned revisions and restores through undo", async () => {
  const directory = await mkdtemp(join(tmpdir(),"human2ai-camera-box-"));
  const server = createHuman2AiServer({databasePath:":memory:",artifactsDirectory:directory});
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const result = await server.inject({ method: (init?.method ?? "GET") as "GET", url: url.pathname + url.search, payload: init?.body as string | undefined, headers: init?.headers as Record<string,string> });
    return new Response(new Uint8Array(result.rawPayload),{status:result.statusCode,headers:{"content-type":String(result.headers["content-type"])}});
  };
  const cli = (args: string[]) => executeCli(args,{fetch:fetcher as typeof fetch});
  try {
    const session = (await server.inject({method:"POST",url:"/api/v1/sessions",payload:{sessionType:"spatial",title:"Six views"}})).json<{id:string}>();
    const root = `/api/v1/sessions/${session.id}/spatial`, draft = createSpatialDraft();
    draft.objects = [{id:"prop",name:"Prop",kind:"box",position:[0,.8,0],rotation:[0,0,0],size:[.5,.8,.3],color:"#bb8877"}];
    expect((await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:0,draft}})).statusCode).toBe(201);
    const box = {...createSpatialCameraBox("six","Six views"),resolution:128};
    const input = join(directory,"operations.json"), output = join(directory,"views.png");
    await writeFile(input,JSON.stringify([{type:"put-camera-box",box},{type:"fit-camera-box",id:box.id,region:"scene"}]));
    const saved = await cli(["spatial","apply","--session",session.id,"--revision","1","--input",input]) as {revision:number};
    expect(saved.revision).toBe(2);
    expect(JSON.stringify(await cli(["session","connect","--session",session.id]))).toContain("spatial.render-box@1");
    const methods = await cli(["spatial","methods"]) as {operations:string[];cameraBoxViews:string[]};
    expect(methods.operations).toContain("fit-camera-box"); expect(methods.cameraBoxViews).toHaveLength(7);
    const rendered = await cli(["spatial","render","--session",session.id,"--revision","2","--box","six","--output",output]);
    expect(rendered).toMatchObject({revision:2,boxId:"six",view:"sheet",pass:"color"});
    const original = await readFile(output);
    expect(await sharp(original).metadata()).toMatchObject({width:408,height:324});
    const url = `${root}/camera-boxes/six.png`;
    const pinned = await server.inject(`${url}?revision=2`);
    expect(pinned.rawPayload).toEqual(original);
    expect(pinned.headers["x-spatial-revision"]).toBe("2"); expect(pinned.headers["cache-control"]).toContain("immutable");
    for (const pass of ["color","structure","depth","skeleton"]) {
      await cli(["spatial","render","--session",session.id,"--revision","2","--box","six","--view","top","--pass",pass,"--output",output]);
      expect(await sharp(await readFile(output)).metadata()).toMatchObject({width:128,height:128});
    }
    expect((await server.inject(`${url}?view=outward`)).statusCode).toBe(400);
    expect((await server.inject(`${url}?pass=invalid`)).statusCode).toBe(400);
    for (const extra of [["--camera","camera-1","--box","six"],["--camera","camera-1","--view","top"],["--box","six","--view","unknown"]]) {
      await expect(cli(["spatial","render","--session",session.id,"--revision","2",...extra,"--output",output])).rejects.toThrow();
    }
    const stale = await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:1,operations:[{type:"remove",id:"six"}]}});
    expect(stale.statusCode).toBe(409);
    const invalid = await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:2,operations:[{type:"remove",id:"six"},{type:"fit-camera-box",id:"missing",region:"hands"}]}});
    expect(invalid.statusCode).toBe(400);
    expect((await server.inject(`${url}?revision=2`)).rawPayload).toEqual(original);
    expect((await server.inject({method:"POST",url:`${root}/operations`,payload:{expectedLatestRevision:2,operations:[{type:"remove",id:"six"}]}})).statusCode).toBe(201);
    expect((await server.inject(url)).statusCode).toBe(404);
    expect((await server.inject(`${url}?revision=2`)).rawPayload).toEqual(original);
    const undo = await server.inject({method:"POST",url:`${root}/drafts/undo`,payload:{expectedLatestRevision:3,changeRevision:3}});
    expect(undo.statusCode).toBe(201); expect(undo.json().draft.cameraBoxes).toHaveLength(1);
    expect(undo.json().draft.cameras).toEqual(draft.cameras);
    expect((await server.inject(url)).rawPayload).toEqual(original);
    expect((await server.inject(`${root}/drafts`)).json().draftVersions).toHaveLength(4);
  } finally { await server.close(); await rm(directory,{recursive:true,force:true}); }
});
