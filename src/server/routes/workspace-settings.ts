import type { FastifyInstance } from "fastify";
import type { WorkspaceSettingsRepository } from "../../database/workspace-settings-repository.ts";
import { RevisionConflictError, InvalidRecordError } from "../../database/project-session-repository.ts";
import { MAX_RETENTION_DAYS, type RetentionSettings } from "../../domain/session/storage.ts";

export function registerWorkspaceSettingsRoutes(server: FastifyInstance, repository: WorkspaceSettingsRepository): void {
  const days = { type: "integer", minimum: 1, maximum: MAX_RETENTION_DAYS };
  const fields = { imageRetentionDays: days, historyRetentionDays: days, trashRetentionDays: days };
  const response = { type: "object", additionalProperties: false, required: ["revision", ...Object.keys(fields)],
    properties: { revision: { type: "integer", minimum: 1 }, ...fields } };
  server.get("/api/v1/settings", { schema: { response: { 200: response } } }, async () => repository.get());
  server.put<{ Body: RetentionSettings & { expectedRevision: number } }>("/api/v1/settings", {
    schema: { body: { type: "object", additionalProperties: false, required: ["expectedRevision", ...Object.keys(fields)],
      properties: { expectedRevision: { type: "integer", minimum: 1 }, ...fields } }, response: { 200: response } },
  }, async (request, reply) => {
    try { return repository.update(request.body); }
    catch (error) {
      if (error instanceof RevisionConflictError) return reply.code(409).send({ code: error.code, message: error.message, actualRevision: error.actualRevision });
      if (error instanceof InvalidRecordError) return reply.code(400).send({ code: error.code, message: error.message });
      throw error;
    }
  });
}
