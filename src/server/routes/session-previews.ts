import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";
import sharp from "sharp";
import { compositionSvgForRaster } from "../../domain/composition/raster.ts";
import type { SessionPreviewSource } from "../../domain/session/preview.ts";
import { SessionPreviewService, type SessionPreviewDependencies } from "../session-preview-service.ts";
import { replyToDraftVersionError } from "./draft-version-routes.ts";

export function registerSessionPreviewRoutes(server: FastifyInstance, dependencies: Omit<SessionPreviewDependencies, "renderCamera" | "onError">) {
  const service = new SessionPreviewService({ ...dependencies, onError: error => server.log.error(error),
    renderCamera: async (id, camera, revision) => {
      const response = await server.inject(`/api/v1/sessions/${encodeURIComponent(id)}/spatial/cameras/${encodeURIComponent(camera)}.png?revision=${revision}`);
      if (response.statusCode !== 200) throw new Error("Camera preview unavailable");
      return response.rawPayload;
    },
  });
  const streams = new Set<ServerResponse>();
  server.addHook("preClose", async () => { for (const stream of streams) stream.end(); await service.close(); });
  server.addHook("onResponse", async request => {
    if ((request.method === "PATCH" || request.method === "DELETE") && request.url.startsWith("/api/v1/sessions/")) service.invalidateMembership();
  });
  const sourceProperties = {
    sessionId: { type: "string", minLength: 1 }, sessionType: { enum: ["ui-layout", "image-composition", "spatial"] },
    cameraId: { type: "string", minLength: 1 }, stateId: { type: "string", minLength: 1 },
  };
  const sourceSchema = { type: "object", additionalProperties: false, required: ["sessionId", "sessionType"], properties: sourceProperties,
    allOf: [{ if: { type: "object", properties: { sessionType: { const: "spatial" } } }, then: { type: "object", required: ["cameraId"] }, else: { type: "object", required: ["stateId"] } }],
  };
  const normalize = (source: SessionPreviewSource): SessionPreviewSource => source.sessionType === "spatial"
    ? { sessionId: source.sessionId, sessionType: source.sessionType, cameraId: source.cameraId }
    : { sessionId: source.sessionId, sessionType: source.sessionType, stateId: source.stateId };
  server.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/preview-sources", async (request, reply) => {
    try { return { sources: service.sources(request.params.sessionId) }; }
    catch (error) { const result = replyToDraftVersionError(reply, error); if (result) return result; throw error; }
  });
  server.post<{ Params: { sessionId: string }; Body: SessionPreviewSource }>("/api/v1/sessions/:sessionId/previews",
    { schema: { body: sourceSchema } }, async (request, reply) => {
      try { return await service.materialize(request.params.sessionId, normalize(request.body)); }
      catch (error) { const result = replyToDraftVersionError(reply, error); if (result) return result; return reply.code(400).send({ code: "SESSION_PREVIEW_UNAVAILABLE", message: "Session preview unavailable." }); }
    });
  server.get<{ Params: { sessionId: string }; Querystring: SessionPreviewSource }>("/api/v1/sessions/:sessionId/preview.png",
    { schema: { querystring: sourceSchema } }, async (request, reply) => {
      try {
        const output = await service.render(request.params.sessionId, normalize(request.query));
        const input = output.mimeType === "image/svg+xml" && request.query.sessionType === "image-composition"
          ? Buffer.from(await compositionSvgForRaster(output.data.toString("utf8"))) : output.data;
        return reply.header("cache-control", "no-store").type("image/png").send(output.mimeType === "image/png" ? input : await sharp(input).png().toBuffer());
      }
      catch (error) { const result = replyToDraftVersionError(reply, error); if (result) return result; return reply.code(400).send({ code: "SESSION_PREVIEW_UNAVAILABLE", message: "Session preview unavailable." }); }
    });
  server.get<{ Params: { sessionId: string }; Querystring: SessionPreviewSource }>("/api/v1/sessions/:sessionId/preview",
    { schema: { querystring: sourceSchema } }, async (request, reply) => {
      try {
        const output = await service.render(request.params.sessionId, normalize(request.query));
        return reply.header("cache-control", "no-store").header("x-content-type-options", "nosniff")
          .header("content-security-policy", "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'")
          .type(output.mimeType).send(output.data);
      }
      catch (error) { const result = replyToDraftVersionError(reply, error); if (result) return result; return reply.code(400).send({ code: "SESSION_PREVIEW_UNAVAILABLE", message: "Session preview unavailable." }); }
    });
  server.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/preview-events", async (request, reply) => {
    try { dependencies.projectSessions.getSession(request.params.sessionId); }
    catch (error) { const result = replyToDraftVersionError(reply, error); if (result) return result; throw error; }
    reply.hijack();
    const stream = reply.raw;
    stream.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    streams.add(stream);
    const notify = () => { if (!stream.destroyed) stream.write("data: {}\n\n"); };
    const unsubscribe = service.subscribe(request.params.sessionId, notify);
    const heartbeat = setInterval(() => { if (!stream.destroyed) stream.write(": heartbeat\n\n"); }, 20_000);
    stream.on("close", () => { clearInterval(heartbeat); unsubscribe(); streams.delete(stream); });
    notify(); // Reconnection always checks the authoritative latest version.
  });
}
