import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ImageAssetRepository } from "../../src/database/image-asset-repository.js";
import { openDatabase, type DatabaseConnection } from "../../src/database/migrate.js";
import { ProjectSessionRepository } from "../../src/database/project-session-repository.js";
import { StyleLibraryRepository } from "../../src/database/style-library-repository.js";
import { registeredCapability } from "../helpers/domain-baseline.js";

const maxImageBytes = 10 * 1024 * 1024;
const harnesses = [
  {
    consumer: "session-images",
    table: "image_assets",
    code: "INVALID_IMAGE_ASSET",
    sizeMessage: `Image files must be between 1 byte and ${maxImageBytes} bytes.`,
    formatMessage: "Only valid PNG, JPEG, WebP, and self-contained SVG images are supported.",
    createUploader(database: DatabaseConnection, directory: string) {
      const session = new ProjectSessionRepository(database).createSession({ sessionType: "ui-layout", title: "Image contract" });
      const repository = new ImageAssetRepository(database, directory);
      return (data: Buffer) => repository.create(session.id, { filename: "input.bin", data });
    },
  },
  {
    consumer: "style-references",
    table: "style_reference_images",
    code: "INVALID_STYLE_REFERENCE",
    sizeMessage: `Reference images must be between 1 byte and ${maxImageBytes} bytes.`,
    formatMessage: "Only valid PNG, JPEG, and WebP reference images are supported.",
    createUploader(database: DatabaseConnection, directory: string) {
      const repository = new StyleLibraryRepository(database, directory);
      const style = repository.createStyle({ name: "Image contract", category: "ui", creatorType: "user", description: "Reference" });
      return async (data: Buffer) => {
        const updated = await repository.addReferenceImage(style.id, { expectedRevision: 1, filename: "input.bin", data });
        return updated.referenceImages[0];
      };
    },
  },
];

it("covers every registered image validation consumer", () => {
  const capability = registeredCapability("asset.image-validation");
  expect(harnesses.map(({ consumer }) => consumer).sort()).toEqual(capability.consumers);
});

describe.each(harnesses)("$consumer image input contract", (harness) => {
  let database: DatabaseConnection;
  let directory: string;
  let upload: ReturnType<typeof harness.createUploader>;

  beforeEach(async () => {
    database = openDatabase(":memory:", resolve("migrations"));
    directory = await mkdtemp(join(tmpdir(), "human2ai-image-contract-"));
    upload = harness.createUploader(database, directory);
  });

  afterEach(async () => {
    database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it.each(["png", "jpeg", "webp"] as const)("identifies %s from bytes and preserves dimensions", async (format) => {
    const data = await sharp({ create: { width: 2, height: 3, channels: 3, background: "white" } })
      .toFormat(format).toBuffer();
    await expect(upload(data)).resolves.toMatchObject({
      mimeType: `image/${format}`, width: 2, height: 3, byteSize: data.byteLength,
    });
  });

  it("accepts an image exactly at the byte limit", async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
    const data = Buffer.alloc(maxImageBytes);
    png.copy(data);
    await expect(upload(data)).resolves.toMatchObject({ byteSize: maxImageBytes, mimeType: "image/png" });
  });

  it.each([
    { name: "empty input", input: () => Buffer.alloc(0), reason: "sizeMessage" },
    { name: "oversized input", input: () => Buffer.alloc(maxImageBytes + 1), reason: "sizeMessage" },
    { name: "undecodable input", input: () => Buffer.from("not an image"), reason: "formatMessage" },
    { name: "unsupported image format", input: () => Buffer.from("GIF89a\u0001\u0000\u0001\u0000\u0000\u0000\u0000"), reason: "formatMessage" },
  ] as const)("rejects $name with the owning domain error and no stored data", async ({ input, reason }) => {
    await expect(upload(input())).rejects.toMatchObject({ code: harness.code, message: harness[reason] });
    expect(database.prepare(`SELECT count(*) AS count FROM ${harness.table}`).get()).toEqual({ count: 0 });
    expect(await readdir(directory, { recursive: true })).toEqual([]);
  });

  it("accepts SVG only for session image nodes", async () => {
    const data = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32"><path d="M2 2L20 28" stroke="black"/></svg>');
    if (harness.consumer === "session-images") {
      await expect(upload(data)).resolves.toMatchObject({
        mimeType: "image/svg+xml", width: 24, height: 32, byteSize: data.byteLength,
      });
    } else {
      await expect(upload(data)).rejects.toMatchObject({ code: harness.code, message: harness.formatMessage });
    }
  });
});
