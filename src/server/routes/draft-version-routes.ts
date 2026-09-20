import type { FastifyInstance, FastifyReply } from "fastify";

import {
  DraftRevisionConflictError,
  DraftSessionTypeMismatchError,
  DraftUndoUnavailableError,
  DraftVersionNotFoundError,
  StyleProcessingStaleError,
} from "../../database/draft-version-errors.ts";
import {
  InvalidRecordError,
  SessionNotFoundError,
} from "../../database/project-session-repository.ts";
import type { CreateDraftVersionInput, DraftVersionOperations, RestoreDraftVersionInput } from "../../domain/session/index.ts";

interface SessionParams {
  sessionId: string;
}

interface DraftVersionParams extends SessionParams {
  revision: number;
}

type CreateDraftVersionBody = CreateDraftVersionInput;

interface UndoDraftVersionBody {
  changeRevision: number;
  expectedLatestRevision: number;
}

interface DraftVersionRouteOptions<TDraft> {
  routePrefix: string;
  draftSchema: Record<string, unknown>;
  repository: DraftVersionOperations<TDraft>;
}

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

const undoDraftVersionBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["changeRevision", "expectedLatestRevision"],
  properties: {
    changeRevision: { type: "integer", minimum: 1 },
    expectedLatestRevision: { type: "integer", minimum: 1 },
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
    changeRevision: { type: "integer", minimum: 1 },
  },
} as const;

export function registerDraftVersionRoutes<TDraft>(
  server: FastifyInstance,
  options: DraftVersionRouteOptions<TDraft>,
): void {
  const draftVersionSchema = {
    type: "object",
    additionalProperties: false,
    required: ["id", "sessionId", "revision", "fingerprint", "draft", "createdAt"],
    properties: {
      id: { type: "string" },
      sessionId: { type: "string" },
      revision: { type: "integer", minimum: 1 },
      fingerprint: { type: "string", pattern: "^draft-[0-9a-f]{8}$" },
      draft: options.draftSchema,
      createdAt: { type: "string" },
      styleProcessing: {
        type: "object", additionalProperties: false,
        required: ["styleId", "styleRevision", "sourceRevision", "resultRevision"],
        properties: {
          styleId: { type: "string" }, styleRevision: { type: "integer", minimum: 1 },
          sourceRevision: { type: "integer", minimum: 0 }, resultRevision: { type: "integer", minimum: 1 },
        },
      },
    },
  } as const;
  const draftsPath = `${options.routePrefix}/drafts`;

  server.get<{ Params: SessionParams; Querystring: { knownRevision?: number } }>(
    `${draftsPath}/latest`,
    {
      schema: {
        params: sessionParamsSchema,
        querystring: { type: "object", properties: { knownRevision: { type: "integer", minimum: 0 } } },
        response: {
          200: {
            type: "object", additionalProperties: false, required: ["draftVersion"],
            properties: { draftVersion: { anyOf: [draftVersionSchema, { type: "null" }] } },
          },
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => execute(reply.header("cache-control", "no-store"), 200, () => ({
      draftVersion: options.repository.getLatestDraftVersion(request.params.sessionId, request.query.knownRevision),
    })),
  );

  server.get<{ Params: SessionParams }>(
    draftsPath,
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
        draftVersions: options.repository.listDraftVersions(request.params.sessionId),
      })),
  );

  server.post<{ Params: SessionParams; Body: CreateDraftVersionBody }>(
    draftsPath,
    {
      schema: {
        params: sessionParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedLatestRevision", "draft"],
          properties: {
            expectedLatestRevision: { type: "integer", minimum: 0 },
            draft: options.draftSchema,
            styleProcessing: {
              type: "object", additionalProperties: false,
              required: ["styleId", "styleRevision", "sessionRevision"],
              properties: {
                styleId: { type: "string", minLength: 1 },
                styleRevision: { type: "integer", minimum: 1 },
                sessionRevision: { type: "integer", minimum: 1 },
              },
            },
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
        options.repository.createDraftVersion(request.params.sessionId, request.body),
      ),
  );

  server.get<{ Params: DraftVersionParams }>(
    `${draftsPath}/:revision`,
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
        options.repository.getDraftVersion(
          request.params.sessionId,
          request.params.revision,
        ),
      ),
  );

  server.post<{ Params: SessionParams; Body: RestoreDraftVersionInput }>(
    `${draftsPath}/restore`,
    {
      schema: {
        params: sessionParamsSchema,
        body: {
          type: "object", additionalProperties: false,
          required: ["targetRevision", "expectedLatestRevision"],
          properties: {
            targetRevision: { type: "integer", minimum: 1 },
            expectedLatestRevision: { type: "integer", minimum: 1 },
          },
        },
        response: { 201: draftVersionSchema, 400: errorSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (request, reply) => execute(reply, 201, () =>
      options.repository.restoreDraftVersion(request.params.sessionId, request.body)),
  );

  server.post<{ Params: SessionParams; Body: UndoDraftVersionBody }>(
    `${draftsPath}/undo`,
    {
      schema: {
        params: sessionParamsSchema,
        body: undoDraftVersionBodySchema,
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
        options.repository.undoDraftVersion(request.params.sessionId, request.body),
      ),
  );
}

export function replyToDraftVersionError(
  reply: FastifyReply,
  error: unknown,
): FastifyReply | undefined {
  if (
    error instanceof SessionNotFoundError
    || error instanceof DraftVersionNotFoundError
  ) {
    return reply.code(404).send({ code: error.code, message: error.message });
  }
  if (error instanceof DraftSessionTypeMismatchError || error instanceof StyleProcessingStaleError) {
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
  if (error instanceof DraftUndoUnavailableError) {
    return reply.code(409).send({
      code: error.code,
      message: error.message,
      changeRevision: error.changeRevision,
    });
  }
  if (error instanceof InvalidRecordError) {
    return reply.code(400).send({ code: error.code, message: error.message });
  }
}

function execute(
  reply: FastifyReply,
  successStatus: 200 | 201,
  operation: () => unknown,
): FastifyReply {
  try {
    return reply.code(successStatus).send(operation());
  } catch (error) {
    const errorReply = replyToDraftVersionError(reply, error);
    if (errorReply) return errorReply;
    throw error;
  }
}
