import type { FastifyInstance } from "fastify";

import uiSketchDraftSchema from "../../../schemas/ui-sketch-draft.schema.json" with {
  type: "json",
};
import type { UiSketchSessionRepository } from "../../database/ui-sketch-session-repository.ts";
import { registerDraftVersionRoutes } from "./draft-version-routes.ts";

const { $schema: _draftDialect, ...fastifyUiSketchDraftSchema } =
  uiSketchDraftSchema;

export function registerUiSketchSessionRoutes(
  server: FastifyInstance,
  repository: UiSketchSessionRepository,
): void {
  server.addSchema(fastifyUiSketchDraftSchema);
  registerDraftVersionRoutes(server, {
    routePrefix: "/api/v1/sessions/:sessionId/ui-sketch",
    draftSchema: { $ref: uiSketchDraftSchema.$id },
    repository,
  });
}
