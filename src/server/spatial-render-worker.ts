import { parentPort } from "node:worker_threads";
import { renderSpatialCameraBoxPng, renderSpatialPng, SpatialRenderContext } from "./spatial-render.ts";
import type { SpatialRenderTask } from "./spatial-render-service.ts";

const context = new SpatialRenderContext();
parentPort!.on("message", async (task: SpatialRenderTask) => {
  try {
    const png = "camera" in task
      ? await renderSpatialPng(task.draft, task.camera, task.pass, undefined, context)
      : await renderSpatialCameraBoxPng(task.draft, task.box, task.view, task.pass, context);
    parentPort!.postMessage({ png });
  } catch (error) { parentPort!.postMessage({ error }); }
});
