import { expect, it } from "vitest";
import { SpatialRenderService } from "../../src/server/spatial-render-service.ts";
import { renderSpatialPng } from "../../src/server/spatial-render.ts";
import { createHumanoid, createSpatialDraft } from "../../src/domain/spatial/index.ts";

it("renders in a worker while allowing event-loop work and preserves exact PNG output", async () => {
  const service = new SpatialRenderService(), draft = createSpatialDraft();
  draft.characters = [createHumanoid("a", "A")];
  draft.cameras[0].width = draft.cameras[0].height = 128;
  try {
    let settled = false;
    const image = service.render({ draft, camera: draft.cameras[0], pass: "color" }).finally(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(settled).toBe(false);
    expect(await image).toEqual(await renderSpatialPng(draft, draft.cameras[0]));
    const [depth, color] = await Promise.all([
      service.render({ draft, camera: draft.cameras[0], pass: "depth" }),
      service.render({ draft, camera: draft.cameras[0], pass: "color" }),
    ]);
    expect(depth).toEqual(await renderSpatialPng(draft, draft.cameras[0], "depth"));
    expect(color).toEqual(await image);
  } finally { await service.close(); }
});
