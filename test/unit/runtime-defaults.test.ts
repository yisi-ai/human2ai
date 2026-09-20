import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveRuntimeDefaults } from "../../src/runtime-defaults.js";

describe("Human2AI runtime defaults", () => {
  it("keeps npm data user-wide and source data inside its checkout regardless of the consumer directory", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-defaults-"));
    const sourceRoot = path.join(directory, "source");
    const installedRoot = path.join(directory, "consumer", "node_modules", "human2ai");
    const anotherInstalledRoot = path.join(directory, "another", "node_modules", "human2ai");
    try {
      await mkdir(path.join(sourceRoot, "scripts"), { recursive: true });
      await writeFile(path.join(sourceRoot, "scripts", "dev.mjs"), "");
      await mkdir(installedRoot, { recursive: true });
      await mkdir(anotherInstalledRoot, { recursive: true });

      expect(resolveRuntimeDefaults(sourceRoot)).toEqual({
        port: 4180,
        apiUrl: "http://127.0.0.1:4180",
        webUrl: "http://localhost:3000",
        databasePath: path.join(sourceRoot, ".human2ai-data", "human2ai.sqlite"),
      });
      expect(resolveRuntimeDefaults(installedRoot)).toEqual({
        port: 4179,
        apiUrl: "http://127.0.0.1:4179",
        webUrl: "http://127.0.0.1:4179",
        databasePath: path.join(os.homedir(), ".human2ai", "human2ai.sqlite"),
      });
      expect(resolveRuntimeDefaults(anotherInstalledRoot)).toEqual(resolveRuntimeDefaults(installedRoot));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
