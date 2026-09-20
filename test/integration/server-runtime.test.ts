import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as migrations from "../../src/database/migrate.js";

import {
  createHuman2AiServer,
  isHuman2AiServiceRunning,
  startHuman2AiServer,
  startHuman2AiWeb,
} from "../../src/server/runtime.js";

describe("Human2AI server runtime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("keeps direct source startup on the development database without launcher overrides", () => {
    vi.stubEnv("HUMAN2AI_DATABASE_PATH", undefined);
    const stopped = new Error("stop before opening a database");
    const open = vi.spyOn(migrations, "openDatabase").mockImplementation(() => {
      throw stopped;
    });

    expect(() => createHuman2AiServer()).toThrow(stopped);
    expect(open).toHaveBeenCalledWith(
      path.resolve(".human2ai-data/human2ai.sqlite"),
      expect.any(String),
    );
  });

  it("probes the development port when starting Web directly from source", async () => {
    vi.stubEnv("HUMAN2AI_PORT", undefined);
    const { HUMAN2AI_SERVICE_CAPABILITIES } = await import("../../src/server/app.js");
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      service: "human2ai",
      status: "ok",
      capabilities: HUMAN2AI_SERVICE_CAPABILITIES,
    }));

    await expect(startHuman2AiWeb({ fetch: fetcher })).resolves.toEqual({
      status: "already-running",
      url: "http://127.0.0.1:4180",
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("http://127.0.0.1:4180/api/v1/health");
  });

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
      expect(response.json()).toEqual({
        service: "human2ai",
        status: "ok",
        capabilities: [
          "typed-sessions",
          "composition-drafts",
          "composition-refinements",
          "ui-sketch-drafts",
          "spatial-drafts",
          "capture-undo",
          "image-assets",
          "style-library",
          "session-styles",
        ],
      });
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
    await mkdir(path.join(webDirectory, "ui-sketch"), { recursive: true });
    await mkdir(path.join(webDirectory, "styles"), { recursive: true });
    await mkdir(path.join(webDirectory, "_next", "static"), { recursive: true });
    await writeFile(path.join(webDirectory, "index.html"), "<h1>Human2AI</h1>");
    await writeFile(
      path.join(webDirectory, "composition", "index.html"),
      "<h1>Composition</h1>",
    );
    await writeFile(
      path.join(webDirectory, "ui-sketch", "index.html"),
      "<h1>UI Sketch</h1>",
    );
    await writeFile(
      path.join(webDirectory, "styles", "index.html"),
      "<h1>Style Library</h1>",
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

      const uiSketch = await server.inject({
        method: "GET",
        url: "/ui-sketch/",
      });
      expect(uiSketch.statusCode).toBe(200);
      expect(uiSketch.body).toContain("UI Sketch");

      const styles = await server.inject({
        method: "GET",
        url: "/styles/",
      });
      expect(styles.statusCode).toBe(200);
      expect(styles.body).toContain("Style Library");

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
      expect(health.json()).toEqual({
        service: "human2ai",
        status: "ok",
        capabilities: [
          "typed-sessions",
          "composition-drafts",
          "composition-refinements",
          "ui-sketch-drafts",
          "spatial-drafts",
          "capture-undo",
          "image-assets",
          "style-library",
          "session-styles",
        ],
      });
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recognizes an existing Human2AI service and does not start another", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        service: "human2ai",
        status: "ok",
        capabilities: [
          "typed-sessions",
          "composition-drafts",
          "composition-refinements",
          "ui-sketch-drafts",
          "spatial-drafts",
          "capture-undo",
          "image-assets",
          "style-library",
          "session-styles",
        ],
      }),
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

  it("rejects an older Human2AI service without the required capabilities", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ service: "human2ai", status: "ok" }),
    ) as typeof fetch;

    await expect(
      isHuman2AiServiceRunning("http://127.0.0.1:4179", fetcher),
    ).resolves.toBe(false);
    await expect(
      startHuman2AiWeb({ port: 4179, fetch: fetcher }),
    ).rejects.toThrow("does not support the required APIs");
  });

  it("does not mistake another health endpoint for Human2AI", async () => {
    const fetcher = vi.fn(async () => Response.json({ status: "ok" })) as typeof fetch;

    await expect(
      isHuman2AiServiceRunning("http://127.0.0.1:4179", fetcher),
    ).resolves.toBe(false);
  });
});
