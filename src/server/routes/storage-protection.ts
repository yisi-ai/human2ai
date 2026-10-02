import type { FastifyInstance } from "fastify";
import type { SessionStorageRepository } from "../../database/session-storage-repository.ts";
import type { StorageProtection } from "../../domain/session/storage.ts";
import { replyToDraftVersionError } from "./draft-version-routes.ts";

export function registerStorageProtectionRoutes(server: FastifyInstance, storage: SessionStorageRepository): void {
  const path = "/api/v1/sessions/:sessionId/storage-protection/:clientId";
  const params = { type: "object", additionalProperties: false, required: ["sessionId", "clientId"], properties: {
    sessionId: { type: "string", minLength: 1 }, clientId: { type: "string", minLength: 1, maxLength: 64 },
  } };
  server.put<{ Params: { sessionId: string; clientId: string }; Body: StorageProtection }>(path, {
    schema: { params, body: { type: "object", additionalProperties: false, required: ["revisions", "assetIds"], properties: {
      revisions: { type: "array", uniqueItems: true, items: { type: "integer", minimum: 1 } },
      assetIds: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
    } } },
  }, async (request, reply) => {
    try { storage.protect(request.params.sessionId, request.params.clientId, request.body); return reply.code(204).send(); }
    catch (error) { const handled = replyToDraftVersionError(reply, error); if (handled) return handled; throw error; }
  });
  server.delete<{ Params: { sessionId: string; clientId: string } }>(path, { schema: { params } }, async (request, reply) => {
    storage.release(request.params.sessionId, request.params.clientId); return reply.code(204).send();
  });
}
