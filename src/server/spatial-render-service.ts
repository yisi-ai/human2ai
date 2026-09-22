import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { SpatialBoxFace, SpatialBoxView, SpatialCamera, SpatialCameraBox, SpatialDraft, SpatialRenderPass } from "../domain/spatial/types.ts";

export type SpatialRenderTask = { draft: SpatialDraft; pass: SpatialRenderPass } & (
  { camera: SpatialCamera } | { box: SpatialCameraBox; view: SpatialBoxView | readonly SpatialBoxFace[] }
);
type Job = { task: SpatialRenderTask; resolve(png: Buffer): void; reject(error: unknown): void };

/** One worker per service; expensive rasterization never runs on the HTTP event loop. */
export class SpatialRenderService {
  private worker?: Worker;
  private jobs: Job[] = [];
  private active?: Job;
  private closed = false;

  render(task: SpatialRenderTask): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (this.closed) { reject(new Error("Spatial renderer closed")); return; }
      this.jobs.push({ task, resolve, reject });
      this.next();
    });
  }

  private next(): void {
    if (this.active || !this.jobs.length || this.closed) return;
    if (!this.worker) {
      if (import.meta.url.endsWith(".ts")) {
        // Development and Vitest use TS; published packages run the compiled JS.
        const loader = pathToFileURL(createRequire(import.meta.url).resolve("tsx/esm/api")).href;
        const entry = new URL("./spatial-render-worker.ts", import.meta.url).href;
        this.worker = new Worker(`import(${JSON.stringify(loader)}).then(({tsImport}) => tsImport(${JSON.stringify(entry)}, ${JSON.stringify(import.meta.url)}))`, { eval: true, execArgv: [] });
      } else this.worker = new Worker(new URL("./spatial-render-worker.js", import.meta.url), { execArgv: [] });
      const worker = this.worker;
      worker.on("message", ({ png, error }: { png?: Uint8Array; error?: unknown }) => {
        if (this.worker !== worker) return;
        const job = this.active; this.active = undefined;
        if (error) job?.reject(error); else job?.resolve(Buffer.from(png!));
        this.worker?.unref(); this.next();
      });
      worker.on("error", error => { if (this.worker === worker) this.fail(error); });
      worker.on("exit", code => { if (this.worker === worker && !this.closed) this.fail(new Error(`Spatial renderer exited: ${code}`)); });
    }
    this.active = this.jobs.shift()!;
    this.worker.ref(); this.worker.postMessage(this.active.task);
  }

  private fail(error: unknown): void {
    this.active?.reject(error); this.active = undefined;
    this.jobs.splice(0).forEach(job => job.reject(error));
    this.worker = undefined;
  }

  async close(): Promise<void> {
    this.closed = true;
    const worker = this.worker;
    this.fail(new Error("Spatial renderer closed"));
    await worker?.terminate();
  }
}
