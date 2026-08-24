import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance, FastifyServerOptions } from "fastify";

import { CompositionSessionRepository } from "../database/composition-session-repository.ts";
import { openDatabase } from "../database/migrate.ts";
import { ProjectSessionRepository } from "../database/project-session-repository.ts";
import { buildServer } from "./app.ts";

const DEFAULT_PORT = 4179;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_WEB_DIRECTORY = fileURLToPath(new URL("../../web/out", import.meta.url));

export interface StartServerOptions {
  databasePath?: string;
  host?: string;
  logger?: FastifyServerOptions["logger"];
  migrationsDirectory?: string;
  port?: number;
  webDirectory?: string;
}

export type CreateServerOptions = Omit<StartServerOptions, "host" | "port">;

export interface RunningHuman2AiServer {
  host: string;
  port: number;
  server: FastifyInstance;
  url: string;
}

export type Human2AiWebStartResult =
  | ({ status: "started" } & RunningHuman2AiServer)
  | { status: "already-running"; url: string };

export interface StartWebOptions extends StartServerOptions {
  fetch?: typeof fetch;
}

export async function startHuman2AiServer(
  options: StartServerOptions = {},
): Promise<RunningHuman2AiServer> {
  const host = options.host ?? DEFAULT_HOST;
  const port = resolvePort(options.port ?? process.env.HUMAN2AI_PORT ?? DEFAULT_PORT);
  const server = createHuman2AiServer(options);

  try {
    const url = await server.listen({ host, port });
    const actualPort = new URL(url).port;
    return {
      host,
      port: Number(actualPort),
      server,
      url,
    };
  } catch (error) {
    await server.close().catch(() => undefined);
    throw error;
  }
}

export async function startHuman2AiWeb(
  options: StartWebOptions = {},
): Promise<Human2AiWebStartResult> {
  const { fetch: fetcher = globalThis.fetch, ...serverOptions } = options;
  const host = serverOptions.host ?? DEFAULT_HOST;
  const port = resolvePort(
    serverOptions.port ?? process.env.HUMAN2AI_PORT ?? DEFAULT_PORT,
  );
  const expectedUrl = `http://${host}:${port}`;

  if (port !== 0 && (await isHuman2AiServiceRunning(expectedUrl, fetcher))) {
    return { status: "already-running", url: expectedUrl };
  }

  const running = await startHuman2AiServer({
    ...serverOptions,
    host,
    port,
    webDirectory: serverOptions.webDirectory ?? DEFAULT_WEB_DIRECTORY,
  });
  return { status: "started", ...running };
}

export async function isHuman2AiServiceRunning(
  serviceUrl: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  try {
    const response = await fetcher(new URL("/api/v1/health", serviceUrl), {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as Record<string, unknown>;
    return payload.service === "human2ai" && payload.status === "ok";
  } catch {
    return false;
  }
}

export function createHuman2AiServer(
  options: CreateServerOptions = {},
): FastifyInstance {
  const databasePath =
    options.databasePath ??
    process.env.HUMAN2AI_DATABASE_PATH ??
    join(homedir(), ".human2ai", "human2ai.sqlite");
  const migrationsDirectory =
    options.migrationsDirectory ??
    fileURLToPath(new URL("../../migrations", import.meta.url));
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  }

  const database = openDatabase(databasePath, migrationsDirectory);
  let databaseClosed = false;
  const closeDatabase = () => {
    if (databaseClosed) return;
    databaseClosed = true;
    database.close();
  };
  const server = buildServer(
    { logger: options.logger ?? false },
    {
      compositionSessions: new CompositionSessionRepository(database),
      projectSessions: new ProjectSessionRepository(database),
      webDirectory: options.webDirectory,
    },
  );

  server.addHook("onClose", async () => {
    closeDatabase();
  });

  return server;
}

function resolvePort(input: number | string): number {
  const port = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid HUMAN2AI_PORT: ${String(input)}`);
  }
  return port;
}
