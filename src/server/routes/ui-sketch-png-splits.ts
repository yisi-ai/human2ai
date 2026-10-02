import type { FastifyInstance } from "fastify";
import type { UiSketchPngSplitRepository } from "../../database/ui-sketch-png-split-repository.ts";
import type { UiSketchSessionRepository } from "../../database/ui-sketch-session-repository.ts";
import { ImageAssetNotFoundError, InvalidImageAssetError } from "../../database/image-asset-repository.ts";
import { SessionNotFoundError } from "../../database/project-session-repository.ts";
import { DraftSessionTypeMismatchError } from "../../database/draft-version-errors.ts";
import uiSketchDraftSchema from "../../../schemas/ui-sketch-draft.schema.json" with { type: "json" };
import type { PngSplitOptions, PngSplitSource } from "../../domain/ui-sketch/png-split.ts";

export function registerUiSketchPngSplitRoutes(server: FastifyInstance, repository: UiSketchPngSplitRepository,
  sessions: UiSketchSessionRepository): void {
  for (const preview of [false, true]) server.post<{ Params: { sessionId: string }; Body: { sources: PngSplitSource[]; options: PngSplitOptions } }>(
    `/api/v1/sessions/:sessionId/ui-sketch/png-splits${preview ? "/preview" : ""}`,
    { schema: {
      params: { type: "object", required: ["sessionId"], properties: { sessionId: { type: "string", minLength: 1 } } },
      body: { type: "object", additionalProperties: false, required: ["sources", "options"], properties: {
        sources: { type: "array", minItems: 1, uniqueItems: true, items: {
          type: "object", additionalProperties: false, required: ["nodeId", "assetId"], properties: {
            nodeId: { type: "string", minLength: 1 }, assetId: { type: "string", minLength: 1 },
            regions: uiSketchDraftSchema.$defs.pngSplit.properties.sources.items.properties.regions,
          },
        } },
        options: { type: "object", additionalProperties: false, required: ["alphaThreshold", "minSize", "gap"], properties: {
          alphaThreshold: { type: "integer", minimum: 0, maximum: 254 },
          minSize: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
          gap: { type: "number", minimum: 0 },
        } },
      } },
    } },
    async (request, reply) => {
      try {
        sessions.getLatestDraftVersion(request.params.sessionId);
        if (new Set(request.body.sources.map(source => source.nodeId)).size !== request.body.sources.length) {
          throw new InvalidImageAssetError("Duplicate PNG source node.");
        }
        return await (preview ? repository.preview(request.params.sessionId, request.body.sources, request.body.options)
          : repository.prepare(request.params.sessionId, request.body.sources, request.body.options));
      } catch (error) {
        if (error instanceof SessionNotFoundError || error instanceof ImageAssetNotFoundError) {
          return reply.code(404).send({ code: error.code, message: error.message });
        }
        if (error instanceof InvalidImageAssetError || error instanceof DraftSessionTypeMismatchError) {
          return reply.code(400).send({ code: error.code, message: error.message });
        }
        throw error;
      }
    },
  );
}
