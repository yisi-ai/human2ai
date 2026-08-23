import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { const: "ok" },
  },
} as const;

export function buildServer(options: FastifyServerOptions = {}): FastifyInstance {
  const server = Fastify(options);

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

  return server;
}
