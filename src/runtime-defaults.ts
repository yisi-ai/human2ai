import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HUMAN2AI_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function isDevelopmentSource(sourceRoot = HUMAN2AI_PACKAGE_ROOT): boolean {
  return existsSync(join(sourceRoot, "scripts", "dev.mjs"));
}

export function resolveRuntimeDefaults(sourceRoot = HUMAN2AI_PACKAGE_ROOT) {
  const development = isDevelopmentSource(sourceRoot);
  const port = development ? 4180 : 4179;
  const apiUrl = `http://127.0.0.1:${port}`;
  return {
    port,
    apiUrl,
    webUrl: development ? "http://localhost:3000" : apiUrl,
    databasePath: join(
      development ? join(sourceRoot, ".human2ai-data") : join(homedir(), ".human2ai"),
      "human2ai.sqlite",
    ),
  };
}
