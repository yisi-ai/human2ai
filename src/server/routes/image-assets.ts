import { createReadStream } from "node:fs";

import type { FastifyInstance, FastifyReply } from "fastify";

import {
  ImageAssetNotFoundError,
  ImageAssetRepository,
  InvalidImageAssetError,
} from "../../database/image-asset-repository.ts";
import { SessionNotFoundError } from "../../database/project-session-repository.ts";

interface SessionParams {
  sessionId: string;
}

interface AssetParams extends SessionParams {
  assetId: string;
}

interface UploadQuery {
  filename: string;
}

const paramsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId"],
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const assetParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sessionId", "assetId"],
  properties: {
    sessionId: { type: "string", minLength: 1 },
    assetId: { type: "string", minLength: 1 },
  },
} as const;

const imageAssetSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "sessionId",
    "originalFilename",
    "mimeType",
    "byteSize",
    "width",
    "height",
    "sha256",
    "createdAt",
  ],
  properties: {
    id: { type: "string" },
    sessionId: { type: "string" },
    originalFilename: { type: "string" },
    mimeType: { enum: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
    byteSize: { type: "integer", minimum: 1 },
    width: { type: "integer", minimum: 1 },
    height: { type: "integer", minimum: 1 },
    sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
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
  },
} as const;

export function registerImageAssetRoutes(
  server: FastifyInstance,
  repository: ImageAssetRepository,
): void {
  server.post<{ Params: SessionParams; Querystring: UploadQuery; Body: Buffer }>(
    "/api/v1/sessions/:sessionId/assets",
    {
      schema: {
        params: paramsSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["filename"],
          properties: { filename: { type: "string", minLength: 1, maxLength: 255 } },
        },
        response: {
          201: imageAssetSchema,
          400: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const asset = await repository.create(request.params.sessionId, {
          filename: request.query.filename,
          data: request.body,
        });
        return reply.code(201).send(asset);
      } catch (error) {
        return sendAssetError(reply, error);
      }
    },
  );

  server.get<{ Params: AssetParams }>(
    "/api/v1/sessions/:sessionId/assets/:assetId/content",
    {
      schema: {
        params: assetParamsSchema,
        response: { 404: errorSchema },
      },
    },
    async (request, reply) => {
      try {
        const { asset, filePath } = repository.get(
          request.params.sessionId,
          request.params.assetId,
        );
        if (asset.mimeType === "image/svg+xml") {
          reply.header("content-security-policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        }
        return reply
          .header("x-content-type-options", "nosniff")
          .header("cache-control", "private, max-age=31536000, immutable")
          .header("content-length", asset.byteSize)
          .type(asset.mimeType)
          .send(createReadStream(filePath));
      } catch (error) {
        return sendAssetError(reply, error);
      }
    },
  );
}

function sendAssetError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof SessionNotFoundError || error instanceof ImageAssetNotFoundError) {
    return reply.code(404).send({ code: error.code, message: error.message });
  }
  if (error instanceof InvalidImageAssetError) {
    return reply.code(400).send({ code: error.code, message: error.message });
  }
  throw error;
}
