import type { FastifyInstance } from "fastify";
import schema from "../../../schemas/spatial-draft.schema.json" with { type: "json" };
import type { SpatialSessionRepository } from "../../database/spatial-session-repository.ts";
import { createSpatialDraft, SpatialConstraintError, type SpatialOperation } from "../../domain/spatial/index.ts";
import { renderSpatialPng, renderSpatialCameraBoxPng } from "../spatial-render.ts";
import { SPATIAL_BOX_FACES, SPATIAL_RENDER_PASSES, type SpatialBoxView, type SpatialRenderPass } from "../../domain/spatial/types.ts";
import { parseSpatialBoxViews } from "../../domain/spatial/camera-box-sheet.ts";
import en from "../../../locales/en/common.json" with { type: "json" };
import { registerDraftVersionRoutes, replyToDraftVersionError } from "./draft-version-routes.ts";

export function registerSpatialSessionRoutes(server: FastifyInstance, repository: SpatialSessionRepository): void {
  const { $schema: _dialect, ...fastifySchema } = schema;
  server.addSchema(fastifySchema);
  registerDraftVersionRoutes(server, { routePrefix: "/api/v1/sessions/:sessionId/spatial", draftSchema: { $ref: schema.$id }, repository });
  const cache = new Map<string, Promise<Buffer>>();
  const cached = (key: string, render: () => Promise<Buffer>) => {
    let pending = cache.get(key);
    if (!pending) {
      pending = render(); cache.set(key, pending);
      if (cache.size > 24) cache.delete(cache.keys().next().value!);
      void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
    }
    return pending;
  };
  server.post<{ Params: { sessionId: string }; Body: { expectedLatestRevision: number; operations: SpatialOperation[] } }>(
    "/api/v1/sessions/:sessionId/spatial/operations",
    { schema: { body: { type: "object", additionalProperties: false, required: ["expectedLatestRevision", "operations"], properties: { expectedLatestRevision: { type: "integer", minimum: 0 }, operations: { type: "array", maxItems: 100, items: { type: "object", required: ["type"], properties: { type: { type: "string" } } } } } } } },
    async (request, reply) => {
      try { return reply.code(201).send(repository.apply(request.params.sessionId, request.body.expectedLatestRevision, request.body.operations)); }
      catch (error) {
        if (error instanceof SpatialConstraintError) return reply.code(422).send({ code: error.code, message: error.message });
        if (error instanceof Error && error.message.startsWith("SPATIAL_INVALID")) return reply.code(400).send({ code: "SPATIAL_INVALID", message: error.message });
        const handled = replyToDraftVersionError(reply, error);
        if (handled) return handled;
        throw error;
      }
    },
  );
  server.get<{ Params: { sessionId: string; cameraId: string }; Querystring: { revision?: number; pass?: SpatialRenderPass } }>(
    "/api/v1/sessions/:sessionId/spatial/cameras/:cameraId.png",
    { schema: { querystring: { type: "object", properties: { revision: { type: "integer", minimum: 1 }, pass: { type: "string", enum: [...SPATIAL_RENDER_PASSES] } } } } },
    async (request, reply) => {
      try {
        const { sessionId, cameraId } = request.params;
        const version = request.query.revision ? repository.getDraftVersion(sessionId, request.query.revision) : repository.listDraftVersions(sessionId).at(-1);
        const draft = version?.draft ?? createSpatialDraft();
        const camera = draft.cameras.find(c => c.id === cameraId);
        if (!camera) return reply.code(404).send({ code: "SPATIAL_CAMERA_NOT_FOUND", message: "Camera not found" });
        const pass = request.query.pass ?? "color";
        const key = JSON.stringify([sessionId, version?.revision ?? 0, cameraId, pass]);
        const pending = cached(key, () => renderSpatialPng(draft, camera, pass));
        return reply.header("cache-control", request.query.revision ? "private, max-age=31536000, immutable" : "no-cache")
          .header("x-spatial-revision", version?.revision ?? 0).header("x-spatial-render-pass", pass).type("image/png").send(await pending);
      } catch (error) {
        const handled = replyToDraftVersionError(reply, error);
        if (handled) return handled;
        throw error;
      }
    },
  );
  server.get<{ Params: { sessionId: string; boxId: string }; Querystring: { revision?: number; pass?: SpatialRenderPass; view?: SpatialBoxView; views?: string } }>(
    "/api/v1/sessions/:sessionId/spatial/camera-boxes/:boxId.png",
    { schema: { querystring: { type: "object", properties: { revision: { type: "integer", minimum: 1 }, pass: { type: "string", enum: [...SPATIAL_RENDER_PASSES] }, view: { type: "string", enum: ["sheet", ...SPATIAL_BOX_FACES] }, views: { type: "string", minLength: 1, maxLength: 128 } } } } },
    async (request, reply) => {
      try {
        if (request.query.view !== undefined && request.query.views !== undefined) return reply.code(400).send({ code: "SPATIAL_INVALID", message: en.spatial.cameraBoxViewConflict });
        const views = request.query.views === undefined ? undefined : parseSpatialBoxViews(request.query.views);
        if (views === null) return reply.code(400).send({ code: "SPATIAL_INVALID", message: en.spatial.cameraBoxViewsError });
        const { sessionId, boxId } = request.params;
        const version = request.query.revision ? repository.getDraftVersion(sessionId, request.query.revision) : repository.listDraftVersions(sessionId).at(-1);
        const box = version?.draft.cameraBoxes?.find(box => box.id === boxId);
        if (!box || !version) return reply.code(404).send({ code: "SPATIAL_CAMERA_NOT_FOUND", message: "Camera box not found" });
        const pass = request.query.pass ?? "color", view = views ?? request.query.view ?? "sheet";
        const key = JSON.stringify([sessionId, version.revision, "camera-box", boxId, view, pass]);
        const png = cached(key, () => renderSpatialCameraBoxPng(version.draft, box, view, pass));
        return reply.header("cache-control", request.query.revision ? "private, max-age=31536000, immutable" : "no-cache")
          .header("x-spatial-revision", version.revision).header("x-spatial-render-pass", pass).header("x-spatial-box-view", typeof view === "string" ? view : "sheet")
          .header("x-spatial-box-views", views?.join(",") ?? (view === "sheet" ? SPATIAL_BOX_FACES.join(",") : view)).type("image/png").send(await png);
      } catch (error) {
        const handled = replyToDraftVersionError(reply, error);
        if (handled) return handled;
        throw error;
      }
    },
  );
}
