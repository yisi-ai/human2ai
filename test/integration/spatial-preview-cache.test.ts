import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createHuman2AiServer } from "../../src/server/runtime.ts";
import { SpatialRenderService } from "../../src/server/spatial-render-service.ts";
import { createSpatialDraft } from "../../src/domain/spatial/index.ts";

it("reuses camera PNGs across invisible edits while preserving revision headers and historical output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "human2ai-preview-cache-"));
  const server = createHuman2AiServer({ databasePath: ":memory:", artifactsDirectory: directory });
  const render = vi.spyOn(SpatialRenderService.prototype, "render");
  try {
    const session = (await server.inject({ method: "POST", url: "/api/v1/sessions", payload: { sessionType: "spatial", title: "Camera cache" } })).json<{ id: string }>();
    const root = `/api/v1/sessions/${session.id}/spatial`, draft = createSpatialDraft();
    Object.assign(draft.cameras[0], { position: [0,0,5], target: [0,0,0], projection: "orthographic", span: 2, width: 128, height: 128 });
    draft.objects = [{ id: "box", name: "Box", kind: "box", position: [10,0,0], rotation: [0,0,0], size: [.5,.5,.5], color: "#ff0000" }];
    expect((await server.inject({ method: "POST", url: `${root}/drafts`, payload: { expectedLatestRevision: 0, draft } })).statusCode).toBe(201);
    const png = (revision: number) => server.inject(`${root}/cameras/camera-1.png?revision=${revision}`);
    const [first, same] = await Promise.all([png(1), png(1)]);
    expect(first.statusCode).toBe(200); expect(same.rawPayload).toEqual(first.rawPayload);
    expect(render).toHaveBeenCalledTimes(1);
    const move = async (revision: number, x: number) => {
      const result = await server.inject({ method: "POST", url: `${root}/operations`, payload: {
        expectedLatestRevision: revision, operations: [{ type: "put-object", object: { ...draft.objects[0], position: [x,0,0] } }],
      } });
      expect(result.statusCode).toBe(201);
    };
    await move(1, 20);
    const outside = await png(2);
    expect(outside.headers["x-spatial-revision"]).toBe("2");
    expect(outside.rawPayload).toEqual(first.rawPayload); expect(render).toHaveBeenCalledTimes(1);
    await move(2, 0);
    const inside = await png(3);
    expect(inside.rawPayload).not.toEqual(first.rawPayload); expect(render).toHaveBeenCalledTimes(2);
    expect((await png(1)).rawPayload).toEqual(first.rawPayload);
    await move(3, 20);
    expect((await png(4)).rawPayload).toEqual(first.rawPayload); expect(render).toHaveBeenCalledTimes(2);
  } finally { render.mockRestore(); await server.close(); await rm(directory, { recursive: true, force: true }); }
});
