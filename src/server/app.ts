import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { CompositionSessionRepository } from "../database/composition-session-repository.ts";
import type { ProjectSessionRepository } from "../database/project-session-repository.ts";
import { registerCompositionSessionRoutes } from "./routes/composition-sessions.ts";
import { registerProjectSessionRoutes } from "./routes/project-sessions.ts";

const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { const: "ok" },
  },
} as const;

export interface ServerDependencies {
  compositionSessions?: CompositionSessionRepository;
  projectSessions?: ProjectSessionRepository;
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
    async () => ({ status: "ok" as const }),
  );

  if (dependencies.projectSessions) {
    registerProjectSessionRoutes(server, dependencies.projectSessions);
  }
  if (dependencies.compositionSessions) {
    registerCompositionSessionRoutes(server, dependencies.compositionSessions);
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
