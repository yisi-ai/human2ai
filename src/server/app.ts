import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { CompositionSessionRepository } from "../database/composition-session-repository.ts";
import type { ImageAssetRepository } from "../database/image-asset-repository.ts";
import type { ProjectSessionRepository } from "../database/project-session-repository.ts";
import type { StyleLibraryRepository } from "../database/style-library-repository.ts";
import type { UiSketchSessionRepository } from "../database/ui-sketch-session-repository.ts";
import { registerCompositionSessionRoutes } from "./routes/composition-sessions.ts";
import { registerImageAssetRoutes } from "./routes/image-assets.ts";
import { registerStyleLibraryRoutes } from "./routes/style-library.ts";
import { registerProjectSessionRoutes } from "./routes/project-sessions.ts";
import { registerUiSketchSessionRoutes } from "./routes/ui-sketch-sessions.ts";
import { registerImageContentTypeParser } from "./image-content-type-parser.ts";
import type { SpatialSessionRepository } from "../database/spatial-session-repository.ts";
import { registerSpatialSessionRoutes } from "./routes/spatial-sessions.ts";

const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["service", "status", "capabilities"],
  properties: {
    service: { const: "human2ai" },
    status: { const: "ok" },
    capabilities: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export const HUMAN2AI_SERVICE_CAPABILITIES = [
  "typed-sessions",
  "composition-drafts",
  "composition-refinements",
  "ui-sketch-drafts",
  "spatial-drafts",
  "capture-undo",
  "image-assets",
  "style-library",
  "session-styles",
] as const;

export interface ServerDependencies {
  compositionSessions?: CompositionSessionRepository;
  imageAssets?: ImageAssetRepository;
  projectSessions?: ProjectSessionRepository;
  styleLibrary?: StyleLibraryRepository;
  uiSketchSessions?: UiSketchSessionRepository;
  spatialSessions?: SpatialSessionRepository;
  webDirectory?: string;
}

export function buildServer(
  options: FastifyServerOptions = {},
  dependencies: ServerDependencies = {},
): FastifyInstance {
  const server = Fastify(options);
  const serviceCapabilities = [
    ...(dependencies.projectSessions ? ["typed-sessions"] : []),
    ...(dependencies.compositionSessions
      ? ["composition-drafts", "composition-refinements"]
      : []),
    ...(dependencies.uiSketchSessions ? ["ui-sketch-drafts"] : []),
    ...(dependencies.spatialSessions ? ["spatial-drafts"] : []),
    ...(dependencies.compositionSessions || dependencies.uiSketchSessions || dependencies.spatialSessions
      ? ["capture-undo"]
      : []),
    ...(dependencies.imageAssets ? ["image-assets"] : []),
    ...(dependencies.styleLibrary ? ["style-library", "session-styles"] : []),
  ];

  server.setErrorHandler((error, _request, reply) => {
    if (isValidationError(error)) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
    return reply.send(error);
  });

  server.get(
    "/api/v1/health",
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({
      service: "human2ai" as const,
      status: "ok" as const,
      capabilities: serviceCapabilities,
    }),
  );

  if (dependencies.projectSessions) {
    registerProjectSessionRoutes(server, dependencies.projectSessions);
  }
  if (dependencies.compositionSessions) {
    registerCompositionSessionRoutes(server, dependencies.compositionSessions);
  }
  if (dependencies.uiSketchSessions) {
    registerUiSketchSessionRoutes(server, dependencies.uiSketchSessions);
  }
  if (dependencies.spatialSessions) registerSpatialSessionRoutes(server, dependencies.spatialSessions);
  if (dependencies.imageAssets || dependencies.styleLibrary) {
    registerImageContentTypeParser(server);
  }
  if (dependencies.imageAssets) {
    registerImageAssetRoutes(server, dependencies.imageAssets);
  }
  if (dependencies.styleLibrary) {
    registerStyleLibraryRoutes(server, dependencies.styleLibrary);
  }
  if (dependencies.webDirectory) {
    server.register(fastifyStatic, {
      root: dependencies.webDirectory,
      redirect: true,
      cacheControl: false,
      setHeaders(reply, filename) {
        reply.header(
          "cache-control",
          filename.includes("/_next/static/") || filename.includes("\\_next\\static\\")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    });
  }

  return server;
}

function isValidationError(error: unknown): error is { message: string; validation: unknown } {
  return (
    error instanceof Error &&
    "validation" in error &&
    Boolean((error as { validation?: unknown }).validation)
  );
}
