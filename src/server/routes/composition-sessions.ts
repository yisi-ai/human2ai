import { Ajv2020 } from "ajv/dist/2020.js";
import type { FastifyInstance, FastifyReply } from "fastify";

import compositionDraftSchema from "../../../schemas/composition-draft.schema.json" with {
  type: "json",
};
import compositionRefinementPlanSchema from "../../../schemas/composition-refinement-plan.schema.json" with {
  type: "json",
};
import {
  CompositionSessionRepository,
  RefinementPlanStaleError,
  RefinementRunNotFoundError,
} from "../../database/composition-session-repository.ts";
import { RefinementConstraintError } from "../../domain/composition/index.ts";
import {
  registerDraftVersionRoutes,
  replyToDraftVersionError,
} from "./draft-version-routes.ts";

const { $schema: _draftDialect, ...fastifyCompositionDraftSchema } =
  compositionDraftSchema;
const { $schema: _planDialect, ...fastifyCompositionRefinementPlanSchema } =
  compositionRefinementPlanSchema;

interface SessionParams {
  sessionId: string;
}

interface RefinementRunParams extends SessionParams {
  refinementRunId: string;
}

interface CreateRefinementRunBody {
  sourceDraftRevision: number;
  plan: unknown;
}

const compositionDraftReference = {
  $ref: compositionDraftSchema.$id,
} as const;

const compositionRefinementPlanReference = {
  $ref: compositionRefinementPlanSchema.$id,
} as const;

const sessionParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId"],
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const refinementRunParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId", "refinementRunId"],
  properties: {
    sessionId: { type: "string", minLength: 1 },
    refinementRunId: { type: "string", minLength: 1 },
  },
} as const;

const refinementResultSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "kind",
    "sourceFingerprint",
    "plan",
    "refinedDraft",
    "appliedOperations",
    "audit",
  ],
  properties: {
    version: { const: 1 },
    kind: { const: "composition-refinement-result" },
    sourceFingerprint: { type: "string", pattern: "^draft-[0-9a-f]{8}$" },
    plan: compositionRefinementPlanReference,
    refinedDraft: compositionDraftReference,
    appliedOperations: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    audit: { type: "object", additionalProperties: true },
  },
} as const;

const refinementRunSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "sessionId",
    "sourceDraftVersionId",
    "sourceDraftRevision",
    "sourceFingerprint",
    "plan",
    "result",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    sessionId: { type: "string" },
    sourceDraftVersionId: { type: "string" },
    sourceDraftRevision: { type: "integer", minimum: 1 },
    sourceFingerprint: { type: "string", pattern: "^draft-[0-9a-f]{8}$" },
    plan: compositionRefinementPlanReference,
    result: refinementResultSchema,
    createdAt: { type: "string" },
  },
} as const;

const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    expectedLatestRevision: { type: "integer", minimum: 0 },
    actualLatestRevision: { type: "integer", minimum: 0 },
    expectedSourceFingerprint: { type: "string" },
    receivedSourceFingerprint: { type: "string" },
    changeRevision: { type: "integer", minimum: 1 },
    audit: { type: "object", additionalProperties: true },
  },
} as const;

export function registerCompositionSessionRoutes(
  server: FastifyInstance,
  repository: CompositionSessionRepository,
): void {
  // Validate versioned plans without Fastify's default removal of fields from other union branches.
  const planValidator = new Ajv2020({ allErrors: true });
  planValidator.addSchema(compositionRefinementPlanSchema);
  server.addSchema(fastifyCompositionDraftSchema);
  server.addSchema(fastifyCompositionRefinementPlanSchema);
  registerDraftVersionRoutes(server, {
    routePrefix: "/api/v1/sessions/:sessionId/composition",
    draftSchema: compositionDraftReference,
    repository,
  });

  server.get<{ Params: SessionParams }>(
    "/api/v1/sessions/:sessionId/composition/refinements",
    {
      schema: {
        params: sessionParamsSchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["refinementRuns"],
            properties: {
              refinementRuns: { type: "array", items: refinementRunSchema },
            },
          },
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () => ({
        refinementRuns: repository.listRefinementRuns(request.params.sessionId),
      })),
  );

  server.post<{ Params: SessionParams; Body: CreateRefinementRunBody }>(
    "/api/v1/sessions/:sessionId/composition/refinements",
    {
      validatorCompiler: ({ schema }) => planValidator.compile(schema),
      schema: {
        params: sessionParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["sourceDraftRevision", "plan"],
          properties: {
            sourceDraftRevision: { type: "integer", minimum: 1 },
            plan: compositionRefinementPlanReference,
          },
        },
        response: {
          201: refinementRunSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
          422: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 201, () =>
        repository.createRefinementRun(request.params.sessionId, request.body),
      ),
  );

  server.get<{ Params: RefinementRunParams }>(
    "/api/v1/sessions/:sessionId/composition/refinements/:refinementRunId",
    {
      schema: {
        params: refinementRunParamsSchema,
        response: {
          200: refinementRunSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () =>
        repository.getRefinementRun(
          request.params.sessionId,
          request.params.refinementRunId,
        ),
      ),
  );
}

function execute(
  reply: FastifyReply,
  successStatus: 200 | 201,
  operation: () => unknown,
): FastifyReply {
  try {
    return reply.code(successStatus).send(operation());
  } catch (error) {
    if (error instanceof RefinementRunNotFoundError) {
      return reply.code(404).send({ code: error.code, message: error.message });
    }
    const draftVersionReply = replyToDraftVersionError(reply, error);
    if (draftVersionReply) return draftVersionReply;
    if (error instanceof RefinementPlanStaleError) {
      return reply.code(409).send({
        code: error.code,
        message: error.message,
        expectedSourceFingerprint: error.expectedSourceFingerprint,
        receivedSourceFingerprint: error.receivedSourceFingerprint,
      });
    }
    if (error instanceof RefinementConstraintError) {
      return reply.code(422).send({
        code: "REFINEMENT_CONSTRAINT",
        message: error.message,
        audit: error.audit,
      });
    }
    throw error;
  }
}
