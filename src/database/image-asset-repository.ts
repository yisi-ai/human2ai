import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join, resolve, sep } from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { inspectImageInput, MAX_IMAGE_ASSET_BYTES } from "./image-input.ts";
import type { DatabaseConnection } from "./migrate.ts";
import { SessionNotFoundError } from "./project-session-repository.ts";

export { MAX_IMAGE_ASSET_BYTES } from "./image-input.ts";

export interface ImageAsset {
  id: string;
  sessionId: string;
  originalFilename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  createdAt: string;
}

interface ImageAssetRow {
  id: string;
  session_id: string;
  relative_path: string;
  original_filename: string;
  mime_type: ImageAsset["mimeType"];
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  created_at: string;
}

export class InvalidImageAssetError extends Error {
  readonly code = "INVALID_IMAGE_ASSET";
}

export class ImageAssetNotFoundError extends Error {
  readonly code = "IMAGE_ASSET_NOT_FOUND";

  constructor(readonly sessionId: string, readonly assetId: string) {
    super(`Image asset ${assetId} was not found in session ${sessionId}`);
  }
}

export class ImageAssetRepository {
  private readonly root: string;

  constructor(
    private readonly database: DatabaseConnection,
    artifactsDirectory: string,
  ) {
    this.root = resolve(artifactsDirectory);
  }

  async create(
    sessionId: string,
    input: { filename: string; data: Buffer },
  ): Promise<ImageAsset> {
    this.assertSession(sessionId);
    const inspected = await inspectImageInput(input.data, { allowSvg: true });
    if ("error" in inspected) {
      throw new InvalidImageAssetError(
        inspected.error === "size"
          ? `Image files must be between 1 byte and ${MAX_IMAGE_ASSET_BYTES} bytes.`
          : "Only valid PNG, JPEG, WebP, and self-contained SVG images are supported.",
      );
    }
    const { format, mimeType, width, height } = inspected.image;

    const id = randomUUID();
    const extension = format === "jpeg" ? "jpg" : format;
    const relativePath = join(sessionId, "source", `${id}.${extension}`);
    const filePath = this.filePath(relativePath);
    const originalFilename = safeFilename(input.filename);
    const sha256 = createHash("sha256").update(input.data).digest("hex");
    const createdAt = new Date().toISOString();

    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, input.data, { flag: "wx", mode: 0o600 });
    try {
      this.database.prepare(
        `INSERT INTO image_assets
          (id, session_id, relative_path, original_filename, mime_type,
           byte_size, width, height, sha256, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        sessionId,
        relativePath,
        originalFilename,
        mimeType,
        input.data.byteLength,
        width,
        height,
        sha256,
        createdAt,
      );
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }

    return this.get(sessionId, id).asset;
  }

  get(sessionId: string, assetId: string): { asset: ImageAsset; filePath: string } {
    this.assertSession(sessionId);
    const row = this.database.prepare<[string, string], ImageAssetRow>(
      `SELECT id, session_id, relative_path, original_filename, mime_type,
              byte_size, width, height, sha256, created_at
       FROM image_assets
       WHERE session_id = ? AND id = ?`,
    ).get(sessionId, assetId);
    if (!row) throw new ImageAssetNotFoundError(sessionId, assetId);
    const filePath = this.filePath(row.relative_path);
    if (!existsSync(filePath)) throw new ImageAssetNotFoundError(sessionId, assetId);
    return { asset: mapImageAsset(row), filePath };
  }

  private assertSession(sessionId: string): void {
    const row = this.database.prepare<[string], { id: string }>(
      "SELECT id FROM sessions WHERE id = ?",
    ).get(sessionId);
    if (!row) throw new SessionNotFoundError(sessionId);
  }

  private filePath(relativePath: string): string {
    const filePath = resolve(this.root, relativePath);
    if (filePath !== this.root && !filePath.startsWith(`${this.root}${sep}`)) {
      throw new InvalidImageAssetError("Image asset path must stay inside the artifacts directory.");
    }
    return filePath;
  }
}

function safeFilename(filename: string): string {
  const value = basename(filename.trim()).slice(0, 255);
  return value || "image";
}

function mapImageAsset(row: ImageAssetRow): ImageAsset {
  return {
    id: row.id,
    sessionId: row.session_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    createdAt: row.created_at,
  };
}
