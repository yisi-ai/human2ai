import type { SessionStorageRepository } from "../database/session-storage-repository.ts";
import type { FastifyInstance } from "fastify";
import type { CompositionSessionRepository } from "../database/composition-session-repository.ts";
import type { UiSketchSessionRepository } from "../database/ui-sketch-session-repository.ts";
import type { SpatialSessionRepository } from "../database/spatial-session-repository.ts";

export function registerStorageMaintenance(server: FastifyInstance, storage: SessionStorageRepository,
  repositories: (CompositionSessionRepository | UiSketchSessionRepository | SpatialSessionRepository)[]): void {
  let timer: ReturnType<typeof setTimeout> | undefined, work: Promise<void> | undefined, closed = false;
  let all = false, lastWrite = Date.now();
  const pending = new Set<string>();
  const run = async () => {
    if (closed || work) return;
    const full = all, sessions = [...pending]; all = false; pending.clear();
    work = (async () => {
      const collections = full ? [await storage.collect()] : [];
      if (!full) for (const id of sessions) collections.push(await storage.collect(id));
      for (const result of collections) if (result.failedFiles.length) server.log.warn({ files: result.failedFiles }, "Image cleanup will retry");
      if (full && Date.now() - lastWrite > 10 * 60_000) storage.compact();
    })().catch(error => { server.log.error(error, "Storage maintenance will retry on the next sweep"); });
    await work; work = undefined;
    if (all || pending.size) schedule();
  };
  const schedule = (id?: string) => {
    if (closed) return;
    if (id) pending.add(id);
    if (!timer) timer = setTimeout(() => { timer = undefined; void run(); }, 2000).unref();
  };
  const unsubscribe = repositories.map(repository => repository.onDraftSaved(({ version }) => {
    lastWrite = Date.now(); schedule(version.sessionId);
  }));
  server.addHook("onReady", async () => { all = true; await run(); });
  server.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode >= 300 || request.method === "GET" || request.method === "HEAD"
      || request.url.includes("/storage-protection/")) return;
    lastWrite = Date.now();
    if (request.method === "DELETE" || request.url === "/api/v1/settings") { all = true; schedule(); }
    else {
      const id = /^\/api\/v1\/sessions\/([^/]+)\//.exec(request.url)?.[1];
      if (id) schedule(decodeURIComponent(id));
    }
  });
  const interval = setInterval(() => { all = true; schedule(); }, 60 * 60_000).unref();
  server.addHook("preClose", async () => {
    closed = true; if (timer) clearTimeout(timer); clearInterval(interval);
    unsubscribe.forEach(stop => stop()); await work;
  });
}
