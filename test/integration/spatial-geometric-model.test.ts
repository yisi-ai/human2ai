import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createHuman2AiServer } from "../../src/server/runtime.ts";
import { executeCli } from "../../src/cli/main.ts";
import { createSpatialDraft, type SpatialDraft } from "../../src/domain/spatial/index.ts";

it("creates, saves, exports and restores the geometric appearance through the Agent CLI and shared history", async () => {
  const directory=await mkdtemp(join(tmpdir(),"human2ai-geometric-"));
  const server=createHuman2AiServer({databasePath:":memory:",artifactsDirectory:directory});
  const fetcher=async (input: string | URL | Request, init?: RequestInit) => {
    const url=new URL(String(input));
    const response=await server.inject({method:(init?.method ?? "GET") as "GET",url:url.pathname+url.search,payload:init?.body as string | undefined,headers:init?.headers as Record<string,string>});
    return new Response(new Uint8Array(response.rawPayload),{status:response.statusCode,headers:{"content-type":String(response.headers["content-type"])}});
  };
  const cli=(args: string[])=>executeCli(args,{fetch:fetcher as typeof fetch});
  try {
    const session=(await server.inject({method:"POST",url:"/api/v1/sessions",payload:{sessionType:"spatial",title:"Geometry"}})).json<{id:string}>();
    const root=`/api/v1/sessions/${session.id}/spatial`,draft=createSpatialDraft();
    draft.cameras[0].width=128; draft.cameras[0].height=128;
    expect((await server.inject({method:"POST",url:`${root}/drafts`,payload:{expectedLatestRevision:0,draft}})).statusCode).toBe(201);
    const input=join(directory,"operations.json"),output=join(directory,"camera.png");
    await writeFile(input,JSON.stringify([
      {type:"add-character",id:"p",name:"Person",appearance:"geometric"},
      {type:"pose-hand",characterId:"p",handBoneId:"left-hand",curl:{thumb:.6,index:.8}},
      {type:"lock-joint",characterId:"p",jointId:"left-index-3",position:true},
    ]));
    const saved=await cli(["spatial","apply","--session",session.id,"--revision","1","--input",input]) as {revision:number;draft:SpatialDraft};
    expect(saved.revision).toBe(2); expect(saved.draft.characters[0].appearance).toBe("geometric");
    await cli(["spatial","render","--session",session.id,"--revision","2","--camera","camera-1","--output",output]);
    const geometric=await readFile(output);
    expect((await server.inject(`${root}/cameras/camera-1.png?revision=2`)).rawPayload).toEqual(geometric);
    await writeFile(input,JSON.stringify([{type:"put-character",character:{...saved.draft.characters[0],appearance:"quaternius"}}]));
    const switched=await cli(["spatial","apply","--session",session.id,"--revision","2","--input",input]) as {revision:number;draft:SpatialDraft};
    expect(switched.revision).toBe(3);
    expect({...switched.draft.characters[0],appearance:"geometric"}).toEqual(saved.draft.characters[0]);
    expect((await server.inject(`${root}/cameras/camera-1.png?revision=3`)).rawPayload).not.toEqual(geometric);
    expect((await server.inject(`${root}/cameras/camera-1.png?revision=2`)).rawPayload).toEqual(geometric);
    const restored=await server.inject({method:"POST",url:`${root}/drafts/undo`,payload:{expectedLatestRevision:3,changeRevision:3}});
    expect(restored.statusCode).toBe(201); expect(restored.json().draft).toEqual(saved.draft);
  } finally { await server.close(); await rm(directory,{recursive:true,force:true}); }
});
