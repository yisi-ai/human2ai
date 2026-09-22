import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";

import {
  STYLE_CATEGORIES,
  STYLE_CREATOR_TYPES,
  type StyleCategory,
  type StyleCreatorType,
  type StyleEntry,
  type StylePreviewModel,
  type StyleReferenceImage,
  type SessionStyleState,
} from "../domain/style/index.ts";
import { defaultStylePromptSummary, MAX_STYLE_PROMPT_SUMMARY_LENGTH } from "../domain/style/prompt-summary.ts";
import { validStyleModel } from "../domain/style/model-input.ts";
import { inspectImageInput, MAX_IMAGE_ASSET_BYTES } from "./image-input.ts";
import type { DatabaseConnection } from "./migrate.ts";
import { ProjectSessionRepository, RevisionConflictError } from "./project-session-repository.ts";

interface StyleEntryRow {
  id: string;
  name: string;
  category: StyleCategory;
  creator_type: StyleCreatorType;
  description: string;
  prompt_summary: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

interface StylePreviewModelRow {
  style_id: string;
  id: string;
  relative_path: string;
  original_filename: string;
  byte_size: number;
  created_at: string;
}

interface StyleReferenceImageRow {
  id: string;
  style_id: string;
  relative_path: string;
  original_filename: string;
  mime_type: StyleReferenceImage["mimeType"];
  byte_size: number;
  width: number;
  height: number;
  position: number;
  created_at: string;
}

export class StyleNotFoundError extends Error {
  readonly code = "STYLE_NOT_FOUND";

  constructor(readonly styleId: string) {
    super(`Style not found: ${styleId}`);
  }
}

export class StyleReferenceNotFoundError extends Error {
  readonly code = "STYLE_REFERENCE_NOT_FOUND";

  constructor(readonly styleId: string, readonly referenceId: string) {
    super(`Style reference ${referenceId} was not found in style ${styleId}`);
  }
}

export class InvalidStyleError extends Error {
  readonly code = "INVALID_STYLE";
}

export class StyleRevisionConflictError extends Error {
  readonly code = "STYLE_REVISION_CONFLICT";

  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(`Expected style revision ${expectedRevision}, received ${actualRevision}`);
  }
}

export class InvalidStyleReferenceError extends Error {
  readonly code = "INVALID_STYLE_REFERENCE";
}

export class StyleLibraryRepository {
  private readonly artifactsRoot: string;

  constructor(
    private readonly database: DatabaseConnection,
    artifactsDirectory: string,
  ) {
    this.artifactsRoot = resolve(artifactsDirectory);
  }

  listStyles(): StyleEntry[] {
    const rows = this.database.prepare<[], StyleEntryRow>(`${STYLE_SELECT}
      ORDER BY updated_at DESC, id
    `).all();
    return rows.map((row) => this.mapStyle(row));
  }

  getStyle(styleId: string): StyleEntry {
    const row = this.database.prepare<[string], StyleEntryRow>(`${STYLE_SELECT}
      WHERE id = ?
    `).get(styleId);
    if (!row) throw new StyleNotFoundError(styleId);
    return this.mapStyle(row);
  }

  getSessionStyle(sessionId: string): SessionStyleState {
    const session = new ProjectSessionRepository(this.database).getSession(sessionId);
    return { session, style: session.styleId ? this.getStyle(session.styleId) : null };
  }

  bindSessionStyle(
    sessionId: string,
    input: { styleId: string | null; expectedRevision: number },
  ): SessionStyleState {
    return this.database.transaction(() => {
      const { session } = this.getSessionStyle(sessionId);
      if (session.revision !== input.expectedRevision) {
        throw new RevisionConflictError(input.expectedRevision, session.revision);
      }
      if (input.styleId !== null) this.getStyle(input.styleId);
      if (session.styleId !== input.styleId) {
        this.database.prepare(
          `UPDATE sessions SET style_id = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ?`,
        ).run(input.styleId, new Date().toISOString(), sessionId, input.expectedRevision);
      }
      return this.getSessionStyle(sessionId);
    })();
  }

  createStyle(input: {
    name: string;
    category: StyleCategory;
    creatorType: StyleCreatorType;
    description: string;
    promptSummary?: string;
  }): StyleEntry {
    const name = requiredText(input.name, "Style name", 200);
    const description = requiredText(input.description, "Style description", 20_000);
    const promptSummary = normalizedPromptSummary(input.promptSummary ?? defaultStylePromptSummary(description));
    const category = styleCategory(input.category);
    const creatorType = styleCreatorType(input.creatorType);
    const id = randomUUID();
    const now = new Date().toISOString();

    this.database.prepare(
      `INSERT INTO style_entries
        (id, name, category, creator_type, description, prompt_summary, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(id, name, category, creatorType, description, promptSummary, now, now);
    return this.getStyle(id);
  }

  updateStyle(
    styleId: string,
    input: {
      expectedRevision: number;
      name?: string;
      category?: StyleCategory;
      description?: string;
      promptSummary?: string;
    },
  ): StyleEntry {
    const style = this.getStyle(styleId);
    assertRevision(input.expectedRevision, style.revision);
    const name = input.name === undefined
      ? style.name
      : requiredText(input.name, "Style name", 200);
    const category = input.category === undefined
      ? style.category
      : styleCategory(input.category);
    const description = input.description === undefined
      ? style.description
      : requiredText(input.description, "Style description", 20_000);
    const promptSummary = input.promptSummary !== undefined
      ? normalizedPromptSummary(input.promptSummary)
      : input.description !== undefined
        ? defaultStylePromptSummary(description)
        : style.promptSummary;
    if (
      name === style.name
      && category === style.category
      && description === style.description
      && promptSummary === style.promptSummary
    ) {
      return style;
    }

    const updatedAt = new Date().toISOString();
    this.database.prepare(
      `UPDATE style_entries
       SET name = ?, category = ?, description = ?, prompt_summary = ?, revision = revision + 1, updated_at = ?
       WHERE id = ? AND revision = ?`,
    ).run(name, category, description, promptSummary, updatedAt, styleId, input.expectedRevision);
    return this.getStyle(styleId);
  }

  async deleteStyle(
    styleId: string,
    input: { expectedRevision: number },
  ): Promise<void> {
    const style = this.getStyle(styleId);
    assertRevision(input.expectedRevision, style.revision);
    this.database.transaction(() => {
      this.database.prepare(
        "UPDATE sessions SET style_id = NULL, revision = revision + 1, updated_at = ? WHERE style_id = ?",
      ).run(new Date().toISOString(), styleId);
      this.database.prepare(
        "DELETE FROM style_entries WHERE id = ? AND revision = ?",
      ).run(styleId, input.expectedRevision);
    })();
    await rm(this.filePath(join("styles", styleId)), { recursive: true, force: true });
  }

  async addReferenceImage(
    styleId: string,
    input: {
      expectedRevision: number;
      filename: string;
      data: Buffer;
    },
  ): Promise<StyleEntry> {
    const style = this.getStyle(styleId);
    assertRevision(input.expectedRevision, style.revision);
    const image = await inspectImage(input.data);
    const id = randomUUID();
    const extension = image.format === "jpeg" ? "jpg" : image.format;
    const relativePath = join("styles", styleId, `${id}.${extension}`);
    const filePath = this.filePath(relativePath);
    const originalFilename = safeFilename(input.filename);
    const createdAt = new Date().toISOString();
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, input.data, { flag: "wx", mode: 0o600 });
    try {
      this.database.transaction(() => {
        this.incrementRevision(styleId, input.expectedRevision, createdAt);
        const position = this.database.prepare<[string], { position: number }>(
          `SELECT coalesce(max(position) + 1, 0) AS position
           FROM style_reference_images
           WHERE style_id = ?`,
        ).get(styleId)?.position ?? 0;
        this.database.prepare(
          `INSERT INTO style_reference_images
            (id, style_id, relative_path, original_filename, mime_type,
             byte_size, width, height, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          styleId,
          relativePath,
          originalFilename,
          image.mimeType,
          input.data.byteLength,
          image.width,
          image.height,
          position,
          createdAt,
        );
      })();
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
    return this.getStyle(styleId);
  }

  async deleteReferenceImage(
    styleId: string,
    referenceId: string,
    input: { expectedRevision: number },
  ): Promise<StyleEntry> {
    const style = this.getStyle(styleId);
    assertRevision(input.expectedRevision, style.revision);
    const reference = this.referenceRow(styleId, referenceId);
    const updatedAt = new Date().toISOString();
    this.database.transaction(() => {
      this.database.prepare(
        "DELETE FROM style_reference_images WHERE style_id = ? AND id = ?",
      ).run(styleId, referenceId);
      this.incrementRevision(styleId, input.expectedRevision, updatedAt);
    })();
    await unlink(this.filePath(reference.relative_path)).catch(() => undefined);
    return this.getStyle(styleId);
  }

  getReferenceImage(
    styleId: string,
    referenceId: string,
  ): { reference: StyleReferenceImage; filePath: string } {
    this.getStyle(styleId);
    const row = this.referenceRow(styleId, referenceId);
    const filePath = this.filePath(row.relative_path);
    if (!existsSync(filePath)) throw new StyleReferenceNotFoundError(styleId, referenceId);
    return { reference: mapReference(row), filePath };
  }

  async setPreviewModel(styleId: string, input: { expectedRevision: number; filename: string; data: Buffer }): Promise<StyleEntry> {
    const style = this.getStyle(styleId);
    assertRevision(input.expectedRevision, style.revision);
    if (!validStyleModel(input.data)) throw new InvalidStyleReferenceError("Use a self-contained GLB 2.0 model up to 10 MB, with embedded geometry and textures and no external decoder dependencies.");
    const previous = this.previewModelRow(styleId);
    const id = randomUUID();
    const relativePath = join("styles", styleId, `${id}.glb`);
    const filePath = this.filePath(relativePath);
    const now = new Date().toISOString();
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, input.data, { flag: "wx", mode: 0o600 });
    try {
      this.database.transaction(() => {
        this.incrementRevision(styleId, input.expectedRevision, now);
        this.database.prepare(`INSERT INTO style_preview_models (style_id, id, relative_path, original_filename, byte_size, created_at)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(style_id) DO UPDATE SET
          id = excluded.id, relative_path = excluded.relative_path, original_filename = excluded.original_filename,
          byte_size = excluded.byte_size, created_at = excluded.created_at
        `).run(styleId, id, relativePath, safeFilename(input.filename), input.data.length, now);
      })();
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
    if (previous) await unlink(this.filePath(previous.relative_path)).catch(() => undefined);
    return this.getStyle(styleId);
  }

  async deletePreviewModel(styleId: string, input: { expectedRevision: number }): Promise<StyleEntry> {
    const style = this.getStyle(styleId);
    assertRevision(input.expectedRevision, style.revision);
    const previous = this.previewModelRow(styleId);
    if (!previous) return style;
    this.database.transaction(() => {
      this.incrementRevision(styleId, input.expectedRevision, new Date().toISOString());
      this.database.prepare("DELETE FROM style_preview_models WHERE style_id = ?").run(styleId);
    })();
    await unlink(this.filePath(previous.relative_path)).catch(() => undefined);
    return this.getStyle(styleId);
  }

  getPreviewModel(styleId: string, modelId: string): { model: StylePreviewModel; filePath: string } {
    this.getStyle(styleId);
    const row = this.previewModelRow(styleId);
    if (!row || row.id !== modelId || !existsSync(this.filePath(row.relative_path))) throw new StyleReferenceNotFoundError(styleId, modelId);
    return { model: mapPreviewModel(row), filePath: this.filePath(row.relative_path) };
  }

  private previewModelRow(styleId: string): StylePreviewModelRow | undefined {
    return this.database.prepare<[string], StylePreviewModelRow>("SELECT * FROM style_preview_models WHERE style_id = ?").get(styleId);
  }

  private mapStyle(row: StyleEntryRow): StyleEntry {
    const references = this.database.prepare<[string], StyleReferenceImageRow>(
      `${REFERENCE_SELECT}
       WHERE style_id = ?
       ORDER BY position, id`,
    ).all(row.id);
    const model = this.previewModelRow(row.id);
    return {
      ...(model ? { previewModel: mapPreviewModel(model) } : {}),
      id: row.id,
      name: row.name,
      category: row.category,
      creatorType: row.creator_type,
      description: row.description,
      promptSummary: row.prompt_summary ?? defaultStylePromptSummary(row.description),
      referenceImages: references.map(mapReference),
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private referenceRow(styleId: string, referenceId: string): StyleReferenceImageRow {
    const row = this.database.prepare<[string, string], StyleReferenceImageRow>(
      `${REFERENCE_SELECT}
       WHERE style_id = ? AND id = ?`,
    ).get(styleId, referenceId);
    if (!row) throw new StyleReferenceNotFoundError(styleId, referenceId);
    return row;
  }

  private incrementRevision(
    styleId: string,
    expectedRevision: number,
    updatedAt: string,
  ): void {
    const result = this.database.prepare(
      `UPDATE style_entries
       SET revision = revision + 1, updated_at = ?
       WHERE id = ? AND revision = ?`,
    ).run(updatedAt, styleId, expectedRevision);
    if (result.changes === 0) {
      const actualRevision = this.getStyle(styleId).revision;
      throw new StyleRevisionConflictError(expectedRevision, actualRevision);
    }
  }

  private filePath(relativePath: string): string {
    const filePath = resolve(this.artifactsRoot, relativePath);
    if (
      filePath !== this.artifactsRoot
      && !filePath.startsWith(`${this.artifactsRoot}${sep}`)
    ) {
      throw new InvalidStyleReferenceError(
        "Style reference path must stay inside the artifacts directory.",
      );
    }
    return filePath;
  }
}

const STYLE_SELECT = `
  SELECT id, name, category, creator_type, description, prompt_summary, revision, created_at, updated_at
  FROM style_entries
`;

const REFERENCE_SELECT = `
  SELECT id, style_id, relative_path, original_filename, mime_type,
         byte_size, width, height, position, created_at
  FROM style_reference_images
`;

async function inspectImage(data: Buffer) {
  const inspected = await inspectImageInput(data);
  if ("error" in inspected) {
    throw new InvalidStyleReferenceError(
      inspected.error === "size"
        ? `Reference images must be between 1 byte and ${MAX_IMAGE_ASSET_BYTES} bytes.`
        : "Only valid PNG, JPEG, and WebP reference images are supported.",
    );
  }
  return inspected.image;
}

function requiredText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidStyleError(`${label} cannot be empty`);
  if (trimmed.length > maxLength) {
    throw new InvalidStyleError(`${label} cannot exceed ${maxLength} characters`);
  }
  return trimmed;
}

function normalizedPromptSummary(value: string): string {
  return requiredText(value.replace(/\s+/gu, " "), "Style prompt summary", MAX_STYLE_PROMPT_SUMMARY_LENGTH);
}

function styleCategory(value: StyleCategory): StyleCategory {
  if (!STYLE_CATEGORIES.includes(value)) {
    throw new InvalidStyleError(`Unsupported style category: ${value}`);
  }
  return value;
}

function styleCreatorType(value: StyleCreatorType): StyleCreatorType {
  if (!STYLE_CREATOR_TYPES.includes(value)) {
    throw new InvalidStyleError(`Unsupported style creator type: ${value}`);
  }
  return value;
}

function assertRevision(expectedRevision: number, actualRevision: number): void {
  if (expectedRevision !== actualRevision) {
    throw new StyleRevisionConflictError(expectedRevision, actualRevision);
  }
}

function safeFilename(filename: string): string {
  const value = basename(filename.trim()).slice(0, 255);
  return value || "reference-image";
}

function mapReference(row: StyleReferenceImageRow): StyleReferenceImage {
  return {
    id: row.id,
    styleId: row.style_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    position: row.position,
    createdAt: row.created_at,
  };
}

function mapPreviewModel(row: StylePreviewModelRow): StylePreviewModel {
  return { id: row.id, originalFilename: row.original_filename, byteSize: row.byte_size, createdAt: row.created_at };
}
