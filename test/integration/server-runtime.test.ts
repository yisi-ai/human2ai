import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createHuman2AiServer,
  isHuman2AiServiceRunning,
  startHuman2AiServer,
  startHuman2AiWeb,
} from "../../src/server/runtime.js";

describe("Human2AI server runtime", () => {
  it("creates the persisted local service with its routes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-runtime-"));
    const server = createHuman2AiServer({
      databasePath: path.join(directory, "human2ai.sqlite"),
      migrationsDirectory: path.resolve("migrations"),
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/health",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ service: "human2ai", status: "ok" });
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects an invalid configured port before starting", async () => {
    await expect(
      startHuman2AiServer({ databasePath: ":memory:", port: 70_000 }),
    ).rejects.toThrow("Invalid HUMAN2AI_PORT: 70000");
  });

  it("serves the exported Web and API from the same origin", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "human2ai-web-runtime-"));
    const webDirectory = path.join(directory, "web");
    await mkdir(path.join(webDirectory, "composition"), { recursive: true });
    await mkdir(path.join(webDirectory, "_next", "static"), { recursive: true });
    await writeFile(path.join(webDirectory, "index.html"), "<h1>Human2AI</h1>");
    await writeFile(
      path.join(webDirectory, "composition", "index.html"),
      "<h1>Composition</h1>",
    );
    await writeFile(path.join(webDirectory, "404.html"), "<h1>Not found</h1>");
    await writeFile(
      path.join(webDirectory, "_next", "static", "app.js"),
      "console.log('ok')",
    );

    const server = createHuman2AiServer({
      databasePath: path.join(directory, "human2ai.sqlite"),
      migrationsDirectory: path.resolve("migrations"),
      webDirectory,
    });

    try {
      const home = await server.inject({ method: "GET", url: "/" });
      expect(home.statusCode).toBe(200);
      expect(home.body).toContain("Human2AI");

      const composition = await server.inject({
        method: "GET",
        url: "/composition/",
      });
      expect(composition.statusCode).toBe(200);
      expect(composition.body).toContain("Composition");

      const asset = await server.inject({
        method: "GET",
        url: "/_next/static/app.js",
      });
      expect(asset.statusCode).toBe(200);
      expect(asset.headers["cache-control"]).toContain("immutable");

      const health = await server.inject({
        method: "GET",
        url: "/api/v1/health",
      });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({ service: "human2ai", status: "ok" });
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recognizes an existing Human2AI service and does not start another", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ service: "human2ai", status: "ok" }),
    ) as typeof fetch;

    expect(
      await isHuman2AiServiceRunning("http://127.0.0.1:4179", fetcher),
    ).toBe(true);
    await expect(
      startHuman2AiWeb({ port: 4179, fetch: fetcher }),
    ).resolves.toEqual({
      status: "already-running",
      url: "http://127.0.0.1:4179",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not mistake another health endpoint for Human2AI", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "ok" })) as typeof fetch;

    await expect(
      isHuman2AiServiceRunning("http://127.0.0.1:4179", fetcher),
    ).resolves.toBe(false);
  });
});
