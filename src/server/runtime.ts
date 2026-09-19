import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { FastifyInstance, FastifyServerOptions } from "fastify";

import { CompositionSessionRepository } from "../database/composition-session-repository.ts";
import { ImageAssetRepository } from "../database/image-asset-repository.ts";
import { openDatabase } from "../database/migrate.ts";
import { ProjectSessionRepository } from "../database/project-session-repository.ts";
import { StyleLibraryRepository } from "../database/style-library-repository.ts";
import { UiSketchSessionRepository } from "../database/ui-sketch-session-repository.ts";
import { SpatialSessionRepository } from "../database/spatial-session-repository.ts";
import { HUMAN2AI_SERVICE_CAPABILITIES, buildServer } from "./app.ts";
import { resolveRuntimeDefaults } from "../runtime-defaults.ts";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_WEB_DIRECTORY = fileURLToPath(new URL("../../web/out", import.meta.url));
const REQUIRED_SERVICE_CAPABILITIES = HUMAN2AI_SERVICE_CAPABILITIES;

type Human2AiServiceStatus = "compatible" | "incompatible" | "unavailable";

export interface StartServerOptions {
  artifactsDirectory?: string;
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
  const port = resolvePort(options.port ?? process.env.HUMAN2AI_PORT ?? resolveRuntimeDefaults().port);
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
    serverOptions.port ?? process.env.HUMAN2AI_PORT ?? resolveRuntimeDefaults().port,
  );
  const expectedUrl = `http://${host}:${port}`;

  if (port !== 0) {
    const serviceStatus = await inspectHuman2AiService(expectedUrl, fetcher);
    if (serviceStatus === "compatible") {
      return { status: "already-running", url: expectedUrl };
    }
    if (serviceStatus === "incompatible") {
      throw new Error(
        `The Human2AI service at ${expectedUrl} does not support the required APIs. Stop it and restart Human2AI.`,
      );
    }
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
  return (await inspectHuman2AiService(serviceUrl, fetcher)) === "compatible";
}

async function inspectHuman2AiService(
  serviceUrl: string,
  fetcher: typeof fetch,
): Promise<Human2AiServiceStatus> {
  try {
    const response = await fetcher(new URL("/api/v1/health", serviceUrl), {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return "unavailable";
    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.service !== "human2ai" || payload.status !== "ok") {
      return "unavailable";
    }
    const capabilities = payload.capabilities;
    return Array.isArray(capabilities)
      && REQUIRED_SERVICE_CAPABILITIES.every((capability) => (
        capabilities.includes(capability)
      ))
      ? "compatible"
      : "incompatible";
  } catch {
    return "unavailable";
  }
}

export function createHuman2AiServer(
  options: CreateServerOptions = {},
): FastifyInstance {
  const defaults = resolveRuntimeDefaults();
  const databasePath =
    options.databasePath ??
    process.env.HUMAN2AI_DATABASE_PATH ??
    defaults.databasePath;
  const migrationsDirectory =
    options.migrationsDirectory ??
    fileURLToPath(new URL("../../migrations", import.meta.url));
  const artifactsDirectory =
    options.artifactsDirectory
    ?? process.env.HUMAN2AI_ARTIFACTS_PATH
    ?? join(dirname(databasePath === ":memory:" ? defaults.databasePath : databasePath), "artifacts");
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
      imageAssets: new ImageAssetRepository(database, artifactsDirectory),
      projectSessions: new ProjectSessionRepository(database),
      styleLibrary: new StyleLibraryRepository(database, artifactsDirectory),
      uiSketchSessions: new UiSketchSessionRepository(database),
      spatialSessions: new SpatialSessionRepository(database),
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
