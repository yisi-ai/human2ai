import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { CompositionSessionRepository } from "../database/composition-session-repository.ts";
import type { ProjectSessionRepository } from "../database/project-session-repository.ts";
import { registerCompositionSessionRoutes } from "./routes/composition-sessions.ts";
import { registerProjectSessionRoutes } from "./routes/project-sessions.ts";

const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["service", "status"],
  properties: {
    service: { const: "human2ai" },
    status: { const: "ok" },
  },
} as const;

export interface ServerDependencies {
  compositionSessions?: CompositionSessionRepository;
  projectSessions?: ProjectSessionRepository;
  webDirectory?: string;
}

export function buildServer(
  options: FastifyServerOptions = {},
  dependencies: ServerDependencies = {},
): FastifyInstance {
  const server = Fastify(options);

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
    async () => ({ service: "human2ai" as const, status: "ok" as const }),
  );

  if (dependencies.projectSessions) {
    registerProjectSessionRoutes(server, dependencies.projectSessions);
  }
  if (dependencies.compositionSessions) {
    registerCompositionSessionRoutes(server, dependencies.compositionSessions);
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
