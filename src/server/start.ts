import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CompositionSessionRepository } from "../database/composition-session-repository.js";
import { openDatabase } from "../database/migrate.js";
import { ProjectSessionRepository } from "../database/project-session-repository.js";
import { buildServer } from "./app.js";

const defaultDatabasePath = join(homedir(), ".human2ai", "human2ai.sqlite");
const databasePath = process.env.HUMAN2AI_DATABASE_PATH ?? defaultDatabasePath;
const migrationsDirectory = fileURLToPath(new URL("../../migrations", import.meta.url));
mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
const database = openDatabase(databasePath, migrationsDirectory);
const compositionSessions = new CompositionSessionRepository(database);
const projectSessions = new ProjectSessionRepository(database);
const server = buildServer(
  { logger: true },
  { compositionSessions, projectSessions },
);
const port = Number(process.env.HUMAN2AI_PORT ?? 4179);

server.addHook("onClose", async () => {
  database.close();
});

await server.listen({ host: "127.0.0.1", port });
