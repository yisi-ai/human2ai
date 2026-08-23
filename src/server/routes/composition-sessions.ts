import type { FastifyInstance, FastifyReply } from "fastify";

import compositionDraftSchema from "../../../schemas/composition-draft.schema.json" with {
  type: "json",
};
import compositionRefinementPlanSchema from "../../../schemas/composition-refinement-plan.schema.json" with {
  type: "json",
};
import {
  CompositionSessionRepository,
  CompositionSessionRequiredError,
  DraftRevisionConflictError,
  DraftVersionNotFoundError,
  RefinementPlanStaleError,
  RefinementRunNotFoundError,
} from "../../database/composition-session-repository.ts";
import {
  InvalidRecordError,
  SessionNotFoundError,
} from "../../database/project-session-repository.ts";
import { RefinementConstraintError } from "../../domain/composition/index.ts";

const { $schema: _draftDialect, ...fastifyCompositionDraftSchema } =
  compositionDraftSchema;
const { $schema: _planDialect, ...fastifyCompositionRefinementPlanSchema } =
  compositionRefinementPlanSchema;

interface SessionParams {
  sessionId: string;
}

interface DraftVersionParams extends SessionParams {
  revision: number;
}

interface RefinementRunParams extends SessionParams {
  refinementRunId: string;
}

interface CreateDraftVersionBody {
  expectedLatestRevision: number;
  draft: unknown;
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

const draftVersionParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId", "revision"],
  properties: {
    sessionId: { type: "string", minLength: 1 },
    revision: { type: "integer", minimum: 1 },
  },
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

const draftVersionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "sessionId", "revision", "fingerprint", "draft", "createdAt"],
  properties: {
    id: { type: "string" },
    sessionId: { type: "string" },
    revision: { type: "integer", minimum: 1 },
    fingerprint: { type: "string", pattern: "^draft-[0-9a-f]{8}$" },
    draft: compositionDraftReference,
    createdAt: { type: "string" },
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
    audit: { type: "object", additionalProperties: true },
  },
} as const;

export function registerCompositionSessionRoutes(
  server: FastifyInstance,
  repository: CompositionSessionRepository,
): void {
  server.addSchema(fastifyCompositionDraftSchema);
  server.addSchema(fastifyCompositionRefinementPlanSchema);

  server.get<{ Params: SessionParams }>(
    "/api/v1/sessions/:sessionId/composition/drafts",
    {
      schema: {
        params: sessionParamsSchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["draftVersions"],
            properties: {
              draftVersions: { type: "array", items: draftVersionSchema },
            },
          },
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () => ({
        draftVersions: repository.listDraftVersions(request.params.sessionId),
      })),
  );

  server.post<{ Params: SessionParams; Body: CreateDraftVersionBody }>(
    "/api/v1/sessions/:sessionId/composition/drafts",
    {
      schema: {
        params: sessionParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedLatestRevision", "draft"],
          properties: {
            expectedLatestRevision: { type: "integer", minimum: 0 },
            draft: compositionDraftReference,
          },
        },
        response: {
          201: draftVersionSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 201, () =>
        repository.createDraftVersion(request.params.sessionId, request.body),
      ),
  );

  server.get<{ Params: DraftVersionParams }>(
    "/api/v1/sessions/:sessionId/composition/drafts/:revision",
    {
      schema: {
        params: draftVersionParamsSchema,
        response: {
          200: draftVersionSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () =>
        repository.getDraftVersion(request.params.sessionId, request.params.revision),
      ),
  );

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
    if (
      error instanceof SessionNotFoundError ||
      error instanceof DraftVersionNotFoundError ||
      error instanceof RefinementRunNotFoundError
    ) {
      return reply.code(404).send({ code: error.code, message: error.message });
    }
    if (error instanceof CompositionSessionRequiredError) {
      return reply.code(409).send({ code: error.code, message: error.message });
    }
    if (error instanceof DraftRevisionConflictError) {
      return reply.code(409).send({
        code: error.code,
        message: error.message,
        expectedLatestRevision: error.expectedLatestRevision,
        actualLatestRevision: error.actualLatestRevision,
      });
    }
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
    if (error instanceof InvalidRecordError) {
      return reply.code(400).send({ code: error.code, message: error.message });
    }
    throw error;
  }
}
