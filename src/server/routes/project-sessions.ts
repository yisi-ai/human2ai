import type { FastifyInstance, FastifyReply } from "fastify";

import {
  InvalidRecordError,
  ProjectNameConflictError,
  ProjectNotFoundError,
  ProjectNotEmptyError,
  ProjectSessionRepository,
  RevisionConflictError,
  SessionNotFoundError,
  SessionGroupNotFoundError,
  SessionGroupNameConflictError,
} from "../../database/project-session-repository.ts";
import { SESSION_TYPES, type SessionType } from "../../domain/session/index.ts";

interface ProjectParams {
  projectId: string;
}

interface SessionParams {
  sessionId: string;
}

interface CreateProjectBody {
  name: string;
  description?: string | null;
}

interface UpdateProjectBody {
  expectedRevision: number;
  name?: string;
  description?: string | null;
}

interface CreateSessionBody {
  sessionType: SessionType;
  title: string;
  projectId?: string | null;
  groupId?: string;
}

interface MoveSessionBody {
  projectId: string | null;
  expectedRevision: number;
}

interface RenameSessionBody {
  title: string;
  expectedRevision: number;
}

interface DeleteSessionBody {
  expectedRevision: number;
}

const nullableStringSchema = {
  anyOf: [{ type: "null" }, { type: "string" }],
} as const;

const nullableDescriptionSchema = {
  anyOf: [{ type: "null" }, { type: "string", maxLength: 2000 }],
} as const;

const projectSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "description",
    "revision",
    "sessionCount",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: nullableStringSchema,
    revision: { type: "integer", minimum: 1 },
    sessionCount: { type: "integer", minimum: 0 },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

export const sessionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "projectId",
    "styleId",
    "sessionType",
    "title",
    "lifecycleStage",
    "revision",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    projectId: nullableStringSchema,
    styleId: nullableStringSchema,
    sessionType: { type: "string", enum: SESSION_TYPES },
    title: { type: "string" },
    lifecycleStage: {
      type: "string",
      enum: ["draft", "interpreted", "approved", "exported"],
    },
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
    sessionCount: { type: "integer", minimum: 1 },
  },
} as const;

const idParamsSchema = (key: "projectId" | "sessionId" | "groupId") =>
  ({
    type: "object",
    additionalProperties: false,
    required: [key],
    properties: { [key]: { type: "string", minLength: 1 } },
  }) as const;

export function registerProjectSessionRoutes(
  server: FastifyInstance,
  repository: ProjectSessionRepository,
): void {
  const groupSchema = {
    type: "object", additionalProperties: false,
    required: ["id", "projectId", "name", "revision", "sessionIds"],
    properties: {
      id: { type: "string" }, projectId: { type: "string" }, name: { type: "string" },
      revision: { type: "integer", minimum: 1 },
      sessionIds: { type: "array", items: { type: "string" } },
    },
  } as const;
  const groupWriteResponse = { 400: errorSchema, 404: errorSchema, 409: errorSchema };
  const revisionProperty = { type: "integer", minimum: 1 } as const;
  const nameProperty = { type: "string", minLength: 1, maxLength: 200 } as const;

  server.get("/api/v1/session-groups", {
    schema: { response: { 200: { type: "object", required: ["groups"], properties: { groups: { type: "array", items: groupSchema } } } } },
  }, async () => ({ groups: repository.listSessionGroups() }));

  server.post<{ Params: ProjectParams; Body: { name: string } }>("/api/v1/projects/:projectId/groups", {
    schema: {
      params: idParamsSchema("projectId"),
      body: { type: "object", additionalProperties: false, required: ["name"], properties: { name: nameProperty } },
      response: { 201: groupSchema, ...groupWriteResponse },
    },
  }, async (request, reply) => execute(reply, 201, () => repository.createSessionGroup(request.params.projectId, request.body)));

  server.patch<{ Params: { groupId: string }; Body: { name: string; expectedRevision: number } }>("/api/v1/session-groups/:groupId", {
    schema: {
      params: idParamsSchema("groupId"),
      body: { type: "object", additionalProperties: false, required: ["name", "expectedRevision"], properties: { name: nameProperty, expectedRevision: revisionProperty } },
      response: { 200: groupSchema, ...groupWriteResponse },
    },
  }, async (request, reply) => execute(reply, 200, () => repository.renameSessionGroup(request.params.groupId, request.body)));

  server.delete<{ Params: { groupId: string }; Body: { expectedRevision: number } }>("/api/v1/session-groups/:groupId", {
    schema: {
      params: idParamsSchema("groupId"),
      body: { type: "object", additionalProperties: false, required: ["expectedRevision"], properties: { expectedRevision: revisionProperty } },
      response: groupWriteResponse,
    },
  }, async (request, reply) => execute(reply, 204, () => repository.deleteSessionGroup(request.params.groupId, request.body)));

  server.put<{ Params: ProjectParams & SessionParams; Body: { groupId: string | null } }>("/api/v1/projects/:projectId/sessions/:sessionId/group", {
    schema: {
      params: { type: "object", additionalProperties: false, required: ["projectId", "sessionId"], properties: { projectId: { type: "string", minLength: 1 }, sessionId: { type: "string", minLength: 1 } } },
      body: { type: "object", additionalProperties: false, required: ["groupId"], properties: { groupId: nullableStringSchema } },
      response: groupWriteResponse,
    },
  }, async (request, reply) => execute(reply, 204, () => repository.setSessionGroup(request.params.projectId, request.params.sessionId, request.body.groupId)));

  server.get(
    "/api/v1/projects",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["projects"],
            properties: { projects: { type: "array", items: projectSchema } },
          },
        },
      },
    },
    async () => ({ projects: repository.listProjects() }),
  );

  server.post<{ Body: CreateProjectBody }>(
    "/api/v1/projects",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            description: nullableDescriptionSchema,
          },
        },
        response: { 201: projectSchema, 400: errorSchema, 409: errorSchema },
      },
    },
    async (request, reply) =>
      execute(reply, 201, () => repository.createProject(request.body)),
  );

  server.get<{ Params: ProjectParams }>(
    "/api/v1/projects/:projectId",
    {
      schema: {
        params: idParamsSchema("projectId"),
        response: { 200: projectSchema, 404: errorSchema },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () => repository.getProject(request.params.projectId)),
  );

  server.patch<{ Params: ProjectParams; Body: UpdateProjectBody }>(
    "/api/v1/projects/:projectId",
    {
      schema: {
        params: idParamsSchema("projectId"),
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedRevision"],
          anyOf: [{ required: ["name"] }, { required: ["description"] }],
          properties: {
            expectedRevision: { type: "integer", minimum: 1 },
            name: { type: "string", minLength: 1, maxLength: 200 },
            description: nullableDescriptionSchema,
          },
        },
        response: {
          200: projectSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () =>
        repository.updateProject(request.params.projectId, request.body),
      ),
  );

  server.delete<{ Params: ProjectParams; Body: DeleteSessionBody }>(
    "/api/v1/projects/:projectId",
    {
      schema: {
        params: idParamsSchema("projectId"),
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedRevision"],
          properties: {
            expectedRevision: { type: "integer", minimum: 1 },
          },
        },
        response: {
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 204, () =>
        repository.deleteProject(request.params.projectId, request.body),
      ),
  );

  server.get<{ Params: ProjectParams }>(
    "/api/v1/projects/:projectId/sessions",
    {
      schema: {
        params: idParamsSchema("projectId"),
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["sessions"],
            properties: { sessions: { type: "array", items: sessionSchema } },
          },
          404: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () => ({
        sessions: repository.listProjectSessions(request.params.projectId),
      })),
  );

  server.get(
    "/api/v1/sessions",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["sessions"],
            properties: { sessions: { type: "array", items: sessionSchema } },
          },
        },
      },
    },
    async () => ({ sessions: repository.listSessions() }),
  );

  server.get(
    "/api/v1/sessions/unassigned",
    {
      schema: {
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["sessions"],
            properties: { sessions: { type: "array", items: sessionSchema } },
          },
        },
      },
    },
    async () => ({ sessions: repository.listUnassignedSessions() }),
  );

  server.post<{ Body: CreateSessionBody }>(
    "/api/v1/sessions",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["sessionType", "title"],
          properties: {
            sessionType: { type: "string", enum: SESSION_TYPES },
            title: { type: "string", minLength: 1, maxLength: 200 },
            projectId: nullableStringSchema,
            groupId: { type: "string", minLength: 1 },
          },
        },
        response: {
          201: sessionSchema,
          400: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 201, () => repository.createSession(request.body)),
  );

  server.get<{ Params: SessionParams }>(
    "/api/v1/sessions/:sessionId",
    {
      schema: {
        params: idParamsSchema("sessionId"),
        response: { 200: sessionSchema, 404: errorSchema },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () => repository.getSession(request.params.sessionId)),
  );

  server.patch<{ Params: SessionParams; Body: RenameSessionBody }>(
    "/api/v1/sessions/:sessionId",
    {
      schema: {
        params: idParamsSchema("sessionId"),
        body: {
          type: "object",
          additionalProperties: false,
          required: ["title", "expectedRevision"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 200 },
            expectedRevision: { type: "integer", minimum: 1 },
          },
        },
        response: {
          200: sessionSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () =>
        repository.renameSession(request.params.sessionId, request.body),
      ),
  );

  server.delete<{ Params: SessionParams; Body: DeleteSessionBody }>(
    "/api/v1/sessions/:sessionId",
    {
      schema: {
        params: idParamsSchema("sessionId"),
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedRevision"],
          properties: {
            expectedRevision: { type: "integer", minimum: 1 },
          },
        },
        response: {
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 204, () =>
        repository.deleteSession(request.params.sessionId, request.body),
      ),
  );

  server.patch<{ Params: SessionParams; Body: MoveSessionBody }>(
    "/api/v1/sessions/:sessionId/project",
    {
      schema: {
        params: idParamsSchema("sessionId"),
        body: {
          type: "object",
          additionalProperties: false,
          required: ["projectId", "expectedRevision"],
          properties: {
            projectId: nullableStringSchema,
            expectedRevision: { type: "integer", minimum: 1 },
          },
        },
        response: {
          200: sessionSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) =>
      execute(reply, 200, () =>
        repository.moveSession(request.params.sessionId, request.body),
      ),
  );
}

function execute<T>(
  reply: FastifyReply,
  successStatus: 200 | 201 | 204,
  operation: () => T,
): T | FastifyReply {
  try {
    return reply.code(successStatus).send(operation());
  } catch (error) {
    if (
      error instanceof ProjectNotFoundError ||
      error instanceof SessionNotFoundError || error instanceof SessionGroupNotFoundError
    ) {
      return reply.code(404).send({ code: error.code, message: error.message });
    }
    if (error instanceof RevisionConflictError) {
      return reply.code(409).send({
        code: error.code,
        message: error.message,
        actualRevision: error.actualRevision,
      });
    }
    if (error instanceof ProjectNameConflictError || error instanceof SessionGroupNameConflictError) {
      return reply.code(409).send({ code: error.code, message: error.message });
    }
    if (error instanceof ProjectNotEmptyError) {
      return reply.code(409).send({
        code: error.code,
        message: error.message,
        sessionCount: error.sessionCount,
      });
    }
    if (error instanceof InvalidRecordError) {
      return reply.code(400).send({ code: error.code, message: error.message });
    }
    throw error;
  }
}
