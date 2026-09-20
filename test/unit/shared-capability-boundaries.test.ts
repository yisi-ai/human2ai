import { SpatialSessionRepository } from "../../src/database/spatial-session-repository.js";
import { registerSpatialSessionRoutes } from "../../src/server/routes/spatial-sessions.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompositionSessionRepository } from "../../src/database/composition-session-repository.js";
import { DraftVersionStore } from "../../src/database/draft-version-store.js";
import { ImageAssetRepository } from "../../src/database/image-asset-repository.js";
import * as imageInput from "../../src/database/image-input.js";
import { openDatabase } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.js";
import { UiSketchSessionRepository } from "../../src/database/ui-sketch-session-repository.js";
import { registerCompositionSessionRoutes } from "../../src/server/routes/composition-sessions.js";
import * as draftRoutes from "../../src/server/routes/draft-version-routes.js";
import { registerUiSketchSessionRoutes } from "../../src/server/routes/ui-sketch-sessions.js";
import { registeredCapability } from "../helpers/domain-baseline.js";

afterEach(() => vi.restoreAllMocks());

const draftRepositories = [
  { name: "3D space", Repository: SpatialSessionRepository, path: "src/database/spatial-session-repository.ts" },
  { name: "composition", Repository: CompositionSessionRepository, path: "src/database/composition-session-repository.ts" },
  { name: "UI sketch", Repository: UiSketchSessionRepository, path: "src/database/ui-sketch-session-repository.ts" },
];

it("guards every registered draft repository adapter", () => {
  const adapters = registeredCapability("capture.draft-versioning").implementations
    .filter(({ role, path }) => role === "adapter" && path.startsWith("src/database/"));
  expect(draftRepositories.map(({ path }) => path).sort()).toEqual(adapters.map(({ path }) => path).sort());
});

// These tests protect the known shared boundary; the contract suite separately
// proves its behavior. A copied implementation can pass contracts but fail here.
describe.each(draftRepositories)("$name shared draft storage", ({ Repository }) => {
  it.each([
    { method: "listDraftVersions", args: ["session"] },
    { method: "getLatestDraftVersion", args: ["session", 2] },
    { method: "getDraftVersion", args: ["session", 1] },
    { method: "createDraftVersion", args: ["session", { expectedLatestRevision: 0, draft: {} }] },
    { method: "restoreDraftVersion", args: ["session", { targetRevision: 1, expectedLatestRevision: 3 }] },
    { method: "undoDraftVersion", args: ["session", { changeRevision: 2, expectedLatestRevision: 2 }] },
  ] as const)("delegates $method and propagates the shared result", ({ method, args }) => {
    const database = openDatabase(":memory:", resolve("migrations"));
    try {
      const repository = new Repository(database);
      const failure = new Error("shared storage boundary");
      const operation = vi.spyOn(DraftVersionStore.prototype, method).mockImplementation(() => {
        throw failure;
      });

      expect(() => Reflect.apply(repository[method], repository, args)).toThrow(failure);
      expect(operation).toHaveBeenCalledExactlyOnceWith(...args);
    } finally {
      database.close();
    }
  });
});

it("registers all draft APIs through the shared route implementation", async () => {
  const database = openDatabase(":memory:", resolve("migrations"));
  const server = Fastify();
  try {
    const registration = vi.spyOn(draftRoutes, "registerDraftVersionRoutes");
    const composition = new CompositionSessionRepository(database);
    const uiSketch = new UiSketchSessionRepository(database);
    registerCompositionSessionRoutes(server, composition);
    registerUiSketchSessionRoutes(server, uiSketch);
    const spatial = new SpatialSessionRepository(database);
    registerSpatialSessionRoutes(server, spatial);
    await server.ready();

    expect(registration).toHaveBeenCalledTimes(3);
    for (const [kind, repository] of [["composition", composition], ["ui-sketch", uiSketch], ["spatial", spatial]] as const) {
      const call = registration.mock.calls.find(([, options]) => options.routePrefix === `/api/v1/sessions/:sessionId/${kind}`);
      expect(call?.[0]).toBe(server);
      expect(call?.[1].repository).toBe(repository);
      expect(server.hasRoute({ method: "POST", url: `/api/v1/sessions/:sessionId/${kind}/drafts` })).toBe(true);
    }
  } finally {
    await server.close();
    database.close();
  }
});

it("uses shared image metadata and honors shared rejections in both image repositories", async () => {
  const database = openDatabase(":memory:", resolve("migrations"));
  const directory = await mkdtemp(join(tmpdir(), "human2ai-image-boundary-"));
  try {
    const session = new ProjectSessionRepository(database).createSession({ sessionType: "ui-layout", title: "Boundary" });
    const images = new ImageAssetRepository(database, directory);
    const styles = new StyleLibraryRepository(database, directory);
    const style = styles.createStyle({ name: "Boundary", category: "ui", creatorType: "user", description: "Reference" });
    const adapters = [
      {
        path: "src/database/image-asset-repository.ts",
        code: "INVALID_IMAGE_ASSET",
        upload: (data: Buffer) => images.create(session.id, { filename: "input.png", data }),
      },
      {
        path: "src/database/style-library-repository.ts",
        code: "INVALID_STYLE_REFERENCE",
        upload: async (data: Buffer) => (await styles.addReferenceImage(style.id, {
          expectedRevision: styles.getStyle(style.id).revision, filename: "input.png", data,
        })).referenceImages[0],
      },
    ];
    expect(adapters.map(({ path }) => path).sort()).toEqual(
      registeredCapability("asset.image-validation").implementations
        .filter(({ role }) => role === "adapter").map(({ path }) => path).sort(),
    );
    const data = Buffer.from("shared validator owns interpretation of these bytes");
    const inspection = vi.spyOn(imageInput, "inspectImageInput");
    for (const adapter of adapters) {
      inspection.mockClear();
      inspection.mockResolvedValueOnce({ image: { format: "png", mimeType: "image/png", width: 17, height: 19 } });
      await expect(adapter.upload(data)).resolves.toMatchObject({ mimeType: "image/png", width: 17, height: 19 });
      expect(inspection).toHaveBeenCalledExactlyOnceWith(
        data, ...(adapter.code === "INVALID_IMAGE_ASSET" ? [{ allowSvg: true }] : []),
      );

      inspection.mockClear();
      inspection.mockResolvedValueOnce({ error: "format" });
      await expect(adapter.upload(data)).rejects.toMatchObject({ code: adapter.code });
      expect(inspection).toHaveBeenCalledExactlyOnceWith(
        data, ...(adapter.code === "INVALID_IMAGE_ASSET" ? [{ allowSvg: true }] : []),
      );
    }
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
