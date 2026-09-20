import { createReadStream } from "node:fs";

import type { FastifyInstance, FastifyReply } from "fastify";

import {
  InvalidStyleError,
  InvalidStyleReferenceError,
  StyleLibraryRepository,
  StyleNotFoundError,
  StyleReferenceNotFoundError,
  StyleRevisionConflictError,
} from "../../database/style-library-repository.ts";
import {
  STYLE_CATEGORIES,
  type StyleCategory,
  type StyleCreatorType,
} from "../../domain/style/index.ts";
import { RevisionConflictError, SessionNotFoundError } from "../../database/project-session-repository.ts";
import { MAX_STYLE_PROMPT_SUMMARY_LENGTH } from "../../domain/style/prompt-summary.ts";
import { sessionSchema } from "./project-sessions.ts";

interface StyleParams {
  styleId: string;
}

interface ReferenceParams extends StyleParams {
  referenceId: string;
}

interface CreateStyleBody {
  name: string;
  category: StyleCategory;
  description: string;
  promptSummary?: string;
}

interface UpdateStyleBody {
  expectedRevision: number;
  name?: string;
  category?: StyleCategory;
  description?: string;
  promptSummary?: string;
}

interface RevisionBody {
  expectedRevision: number;
}

interface UploadReferenceQuery {
  filename: string;
  expectedRevision: number;
}

const styleParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["styleId"],
  properties: { styleId: { type: "string", minLength: 1 } },
} as const;

const referenceParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["styleId", "referenceId"],
  properties: {
    styleId: { type: "string", minLength: 1 },
    referenceId: { type: "string", minLength: 1 },
  },
} as const;

const referenceImageSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "styleId",
    "originalFilename",
    "mimeType",
    "byteSize",
    "width",
    "height",
    "position",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    styleId: { type: "string" },
    originalFilename: { type: "string" },
    mimeType: { enum: ["image/png", "image/jpeg", "image/webp"] },
    byteSize: { type: "integer", minimum: 1 },
    width: { type: "integer", minimum: 1 },
    height: { type: "integer", minimum: 1 },
    position: { type: "integer", minimum: 0 },
    createdAt: { type: "string" },
  },
} as const;

const styleSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "category",
    "creatorType",
    "description",
    "promptSummary",
    "referenceImages",
    "revision",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: { enum: STYLE_CATEGORIES },
    creatorType: { enum: ["user", "agent"] },
    description: { type: "string" },
    promptSummary: { type: "string" },
    referenceImages: { type: "array", items: referenceImageSchema },
    revision: { type: "integer", minimum: 1 },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    actualRevision: { type: "integer", minimum: 1 },
  },
} as const;

const createStyleBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "category", "description"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    category: { enum: STYLE_CATEGORIES },
    description: { type: "string", minLength: 1, maxLength: 20_000 },
    promptSummary: { type: "string", minLength: 1, maxLength: MAX_STYLE_PROMPT_SUMMARY_LENGTH },
  },
} as const;

export function registerStyleLibraryRoutes(
  server: FastifyInstance,
  repository: StyleLibraryRepository,
): void {
  const sessionStyleSchema = {
    type: "object", additionalProperties: false, required: ["session", "style"],
    properties: { session: sessionSchema, style: { anyOf: [styleSchema, { type: "null" }] } },
  } as const;
  const sessionParams = {
    type: "object", additionalProperties: false, required: ["sessionId"],
    properties: { sessionId: { type: "string", minLength: 1 } },
  } as const;
  server.get<{ Params: { sessionId: string } }>(
    "/api/v1/sessions/:sessionId/style",
    { schema: { params: sessionParams, response: { 200: sessionStyleSchema, 404: errorSchema } } },
    async (request, reply) => execute(reply, 200, () => repository.getSessionStyle(request.params.sessionId)),
  );
  server.patch<{
    Params: { sessionId: string };
    Body: { styleId: string | null; expectedRevision: number };
  }>(
    "/api/v1/sessions/:sessionId/style",
    { schema: {
      params: sessionParams,
      body: {
        type: "object", additionalProperties: false, required: ["styleId", "expectedRevision"],
        properties: {
          styleId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
          expectedRevision: { type: "integer", minimum: 1 },
        },
      },
      response: { 200: sessionStyleSchema, 404: errorSchema, 409: errorSchema },
    } },
    async (request, reply) => execute(reply, 200, () => repository.bindSessionStyle(request.params.sessionId, request.body)),
  );
  server.get(
    "/api/v1/styles",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["styles"],
            properties: { styles: { type: "array", items: styleSchema } },
          },
        },
      },
    },
    async () => ({ styles: repository.listStyles() }),
  );

  registerCreateStyleRoute(server, repository, "/api/v1/styles", "user");
  registerCreateStyleRoute(server, repository, "/api/v1/agent/styles", "agent");

  server.get<{ Params: StyleParams }>(
    "/api/v1/styles/:styleId",
    {
      schema: {
        params: styleParamsSchema,
        response: { 200: styleSchema, 404: errorSchema },
      },
    },
    async (request, reply) => execute(reply, 200, () => (
      repository.getStyle(request.params.styleId)
    )),
  );

  server.get<{ Params: StyleParams }>(
    "/api/v1/agent/styles/:styleId/context",
    {
      schema: {
        params: styleParamsSchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["referenceImages", "description"],
            properties: {
              referenceImages: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url"],
                  properties: { url: { type: "string" } },
                },
              },
              description: { type: "string" },
            },
          },
          404: errorSchema,
        },
      },
    },
    async (request, reply) => execute(reply, 200, () => {
      const style = repository.getStyle(request.params.styleId);
      return {
        referenceImages: style.referenceImages.map((reference) => ({
          url: styleReferenceContentPath(style.id, reference.id),
        })),
        description: style.description,
      };
    }),
  );

  server.patch<{ Params: StyleParams; Body: UpdateStyleBody }>(
    "/api/v1/styles/:styleId",
    {
      schema: {
        params: styleParamsSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedRevision"],
          anyOf: [
            { required: ["name"] },
            { required: ["category"] },
            { required: ["description"] },
            { required: ["promptSummary"] },
          ],
          properties: {
            expectedRevision: { type: "integer", minimum: 1 },
            name: { type: "string", minLength: 1, maxLength: 200 },
            category: { enum: STYLE_CATEGORIES },
            description: { type: "string", minLength: 1, maxLength: 20_000 },
            promptSummary: { type: "string", minLength: 1, maxLength: MAX_STYLE_PROMPT_SUMMARY_LENGTH },
          },
        },
        response: {
          200: styleSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => execute(reply, 200, () => (
      repository.updateStyle(request.params.styleId, request.body)
    )),
  );

  server.delete<{ Params: StyleParams; Body: RevisionBody }>(
    "/api/v1/styles/:styleId",
    {
      schema: {
        params: styleParamsSchema,
        body: revisionBodySchema,
        response: { 400: errorSchema, 404: errorSchema, 409: errorSchema },
      },
    },
    async (request, reply) => execute(reply, 204, () => (
      repository.deleteStyle(request.params.styleId, request.body)
    )),
  );

  server.post<{
    Params: StyleParams;
    Querystring: UploadReferenceQuery;
    Body: Buffer;
  }>(
    "/api/v1/styles/:styleId/references",
    {
      schema: {
        params: styleParamsSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["filename", "expectedRevision"],
          properties: {
            filename: { type: "string", minLength: 1, maxLength: 255 },
            expectedRevision: { type: "integer", minimum: 1 },
          },
        },
        response: {
          201: styleSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => execute(reply, 201, () => (
      repository.addReferenceImage(request.params.styleId, {
        filename: request.query.filename,
        expectedRevision: request.query.expectedRevision,
        data: request.body,
      })
    )),
  );

  server.delete<{ Params: ReferenceParams; Body: RevisionBody }>(
    "/api/v1/styles/:styleId/references/:referenceId",
    {
      schema: {
        params: referenceParamsSchema,
        body: revisionBodySchema,
        response: {
          200: styleSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => execute(reply, 200, () => (
      repository.deleteReferenceImage(
        request.params.styleId,
        request.params.referenceId,
        request.body,
      )
    )),
  );

  server.get<{ Params: ReferenceParams }>(
    "/api/v1/styles/:styleId/references/:referenceId/content",
    {
      schema: {
        params: referenceParamsSchema,
        response: { 404: errorSchema },
      },
    },
    async (request, reply) => {
      try {
        const { reference, filePath } = repository.getReferenceImage(
          request.params.styleId,
          request.params.referenceId,
        );
        return reply
          .header("cache-control", "private, max-age=31536000, immutable")
          .header("content-length", reference.byteSize)
          .type(reference.mimeType)
          .send(createReadStream(filePath));
      } catch (error) {
        return sendStyleError(reply, error);
      }
    },
  );
}

const revisionBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["expectedRevision"],
  properties: { expectedRevision: { type: "integer", minimum: 1 } },
} as const;

function registerCreateStyleRoute(
  server: FastifyInstance,
  repository: StyleLibraryRepository,
  pathname: "/api/v1/styles" | "/api/v1/agent/styles",
  creatorType: StyleCreatorType,
): void {
  server.post<{ Body: CreateStyleBody }>(
    pathname,
    {
      schema: {
        body: createStyleBodySchema,
        response: { 201: styleSchema, 400: errorSchema },
      },
    },
    async (request, reply) => execute(reply, 201, () => (
      repository.createStyle({ ...request.body, creatorType })
    )),
  );
}

async function execute(
  reply: FastifyReply,
  successStatus: 200 | 201 | 204,
  action: () => unknown | Promise<unknown>,
): Promise<FastifyReply> {
  try {
    const result = await action();
    return successStatus === 204
      ? reply.code(204).send()
      : reply.code(successStatus).send(result);
  } catch (error) {
    return sendStyleError(reply, error);
  }
}

function sendStyleError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof StyleRevisionConflictError || error instanceof RevisionConflictError) {
    return reply.code(409).send({
      code: error.code,
      message: error.message,
      actualRevision: error.actualRevision,
    });
  }
  if (
    error instanceof StyleNotFoundError
    || error instanceof StyleReferenceNotFoundError
    || error instanceof SessionNotFoundError
  ) {
    return reply.code(404).send({ code: error.code, message: error.message });
  }
  if (error instanceof InvalidStyleError || error instanceof InvalidStyleReferenceError) {
    return reply.code(400).send({ code: error.code, message: error.message });
  }
  throw error;
}

function styleReferenceContentPath(styleId: string, referenceId: string): string {
  return `/api/v1/styles/${encodeURIComponent(styleId)}/references/${encodeURIComponent(referenceId)}/content`;
}
