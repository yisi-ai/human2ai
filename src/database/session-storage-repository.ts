import { readdir, lstat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import type { DatabaseConnection } from "./migrate.ts";
import { ImageAssetNotFoundError, type ImageAssetRepository } from "./image-asset-repository.ts";
import { InvalidRecordError, SessionNotFoundError, ProjectSessionRepository } from "./project-session-repository.ts";
import { WorkspaceSettingsRepository } from "./workspace-settings-repository.ts";
import { DraftVersionExpiredError, DraftVersionNotFoundError } from "./draft-version-errors.ts";
import { HISTORY_VERSION_LIMIT, STORAGE_PROTECTION_MS, type StorageProtection } from "../domain/session/storage.ts";
import type { SessionType } from "../domain/session/types.ts";

const tables = {
  "image-composition": "composition_draft_versions",
  "ui-layout": "ui_sketch_draft_versions",
  spatial: "spatial_draft_versions",
} as const;
export type DraftVersionTable = typeof tables[SessionType];

/** Called inside the save transaction so the latest revision is never removed. */
export function pruneDraftVersions(database: DatabaseConnection, table: DraftVersionTable, sessionId: string, now = Date.now()): number {
  const { historyRetentionDays } = new WorkspaceSettingsRepository(database).get();
  return database.prepare(`DELETE FROM ${table} WHERE session_id = ?
    AND revision != (SELECT max(revision) FROM ${table} WHERE session_id = ?)
    AND (created_at <= ? OR revision NOT IN (SELECT revision FROM ${table} WHERE session_id = ? ORDER BY revision DESC LIMIT ?))
    AND revision NOT IN (
      SELECT held.value FROM session_storage_protections protection, json_each(protection.revisions_json) held
      WHERE protection.session_id = ? AND protection.expires_at > ?
    )`).run(sessionId, sessionId, new Date(now - historyRetentionDays * 86_400_000).toISOString(), sessionId, HISTORY_VERSION_LIMIT,
      sessionId, new Date(now).toISOString()).changes;
}

export interface StorageCollectionResult {
  versionsDeleted: number;
  imagesDeleted: number;
  bytesFreed: number;
  failedFiles: string[];
}

export class SessionStorageRepository {
  private readonly root: string;
  constructor(private readonly database: DatabaseConnection, private readonly assets: ImageAssetRepository,
    artifactsDirectory: string, private readonly now: () => number = Date.now) {
    this.root = resolve(artifactsDirectory);
  }

  protect(sessionId: string, clientId: string, protection: StorageProtection): void {
    const table = this.table(sessionId);
    this.database.transaction(() => {
      const missing = this.database.prepare<[string, string], { value: string }>(`SELECT held.value
        FROM json_each(?) held LEFT JOIN image_assets asset ON asset.id = held.value AND asset.session_id = ? AND asset.deleting = 0
        WHERE asset.id IS NULL LIMIT 1`).get(JSON.stringify(protection.assetIds), sessionId);
      if (missing) throw new ImageAssetNotFoundError(sessionId, missing.value);
      const expired = this.database.prepare<[string, string], { value: number }>(`SELECT held.value
        FROM json_each(?) held LEFT JOIN ${table} version ON version.revision = held.value AND version.session_id = ?
        WHERE version.id IS NULL LIMIT 1`).get(JSON.stringify(protection.revisions), sessionId);
      if (expired) {
        const latest = this.database.prepare<[string], { revision: number }>(`SELECT max(revision) AS revision FROM ${table} WHERE session_id = ?`).get(sessionId);
        if (expired.value <= (latest?.revision ?? 0)) throw new DraftVersionExpiredError(sessionId, expired.value);
        throw new DraftVersionNotFoundError(sessionId, expired.value, "session");
      }
      this.database.prepare(`INSERT INTO session_storage_protections VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id, client_id) DO UPDATE SET revisions_json = excluded.revisions_json,
        asset_ids_json = excluded.asset_ids_json, expires_at = excluded.expires_at`).run(sessionId, clientId,
          JSON.stringify([...new Set(protection.revisions)]), JSON.stringify([...new Set(protection.assetIds)]),
          new Date(this.now() + STORAGE_PROTECTION_MS).toISOString());
      // Reintroducing a reference restarts the continuous no-reference grace period.
      this.database.prepare("UPDATE image_assets SET unreferenced_since = NULL WHERE session_id = ? AND id IN (SELECT value FROM json_each(?))")
        .run(sessionId, JSON.stringify(protection.assetIds));
    })();
  }

  release(sessionId: string, clientId: string): void {
    this.database.prepare("DELETE FROM session_storage_protections WHERE session_id = ? AND client_id = ?").run(sessionId, clientId);
  }

  private table(sessionId: string): DraftVersionTable {
    const session = this.database.prepare<[string], { session_type: SessionType }>("SELECT session_type FROM sessions WHERE id = ? AND deleted_at IS NULL").get(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return tables[session.session_type];
  }

  private usedAssets(sessionId: string): Set<string> {
    const table = this.table(sessionId);
    const rows = this.database.prepare<[string, string, string], { id: string }>(`SELECT DISTINCT json_extract(image.value, '$.assetId') AS id
      FROM ${table} version, json_each(version.draft_json, '$.images') image
      WHERE version.session_id = ? AND json_extract(image.value, '$.assetId') IS NOT NULL
      UNION SELECT held.value AS id FROM session_storage_protections protection, json_each(protection.asset_ids_json) held
      WHERE protection.session_id = ? AND protection.expires_at > ?`).all(sessionId, sessionId, new Date(this.now()).toISOString());
    return new Set(rows.map(row => row.id));
  }

  async collect(sessionId?: string): Promise<StorageCollectionResult> {
    const result: StorageCollectionResult = { versionsDeleted: 0, imagesDeleted: 0, bytesFreed: 0, failedFiles: [] };
    const now = new Date(this.now()).toISOString();
    const settings = new WorkspaceSettingsRepository(this.database).get();
    if (!sessionId) new ProjectSessionRepository(this.database).purgeExpiredTrash(new Date(this.now() - settings.trashRetentionDays * 86_400_000).toISOString());
    this.database.prepare("DELETE FROM session_storage_protections WHERE expires_at <= ?").run(now);
    const sessions = this.database.prepare<string[], { id: string }>(`SELECT id FROM sessions WHERE deleted_at IS NULL${sessionId ? " AND id = ?" : ""}`)
      .all(...(sessionId ? [sessionId] : []));
    for (const session of sessions) {
      const table = this.table(session.id);
      result.versionsDeleted += this.database.transaction(() => pruneDraftVersions(this.database, table, session.id, this.now()))();
      const used = this.usedAssets(session.id);
      const rows = this.database.prepare<[string], { id: string; relative_path: string; unreferenced_since: string | null; deleting: number }>(
        "SELECT id, relative_path, unreferenced_since, deleting FROM image_assets WHERE session_id = ?").all(session.id);
      for (const row of rows) {
        if (used.has(row.id) || this.assets.isProtected(row.id)) {
          this.database.prepare("UPDATE image_assets SET unreferenced_since = NULL WHERE id = ?").run(row.id);
          continue;
        }
        if (!row.unreferenced_since) {
          this.database.prepare("UPDATE image_assets SET unreferenced_since = ? WHERE id = ?").run(now, row.id);
          continue;
        }
        if (!row.deleting && Date.parse(row.unreferenced_since) > this.now() - settings.imageRetentionDays * 86_400_000) continue;
        const file = join(this.root, row.relative_path);
        const size = await fileSize(file);
        const claimed = this.database.transaction(() => {
          const active = this.database.prepare("SELECT id FROM sessions WHERE id = ? AND deleted_at IS NULL").get(session.id);
          if (!active) return false;
          const { imageRetentionDays } = new WorkspaceSettingsRepository(this.database).get();
          // Filesystem awaits allow a save, lease renewal or split task to introduce references.
          const current = this.database.prepare<[string], { unreferenced_since: string | null; deleting: number }>(
            "SELECT unreferenced_since, deleting FROM image_assets WHERE id = ?").get(row.id);
          if (!current || (!current.deleting && (!current.unreferenced_since
            || Date.parse(current.unreferenced_since) > this.now() - imageRetentionDays * 86_400_000))) return false;
          if (this.assets.isProtected(row.id) || this.usedAssets(session.id).has(row.id)) {
            this.database.prepare("UPDATE image_assets SET unreferenced_since = NULL WHERE id = ?").run(row.id);
            return false;
          }
          return this.database.prepare("UPDATE image_assets SET deleting = 1 WHERE id = ?").run(row.id).changes > 0;
        })();
        if (!claimed) continue;
        try {
          await removeFile(file);
          this.database.transaction(() => {
            // Cache records are retry checkpoints, not permanent ownership of deleted slices.
            this.database.prepare(`DELETE FROM ui_sketch_png_splits WHERE session_id = ? AND
              EXISTS (SELECT 1 FROM json_each(record_json, '$.sources') source WHERE json_extract(source.value, '$.assetId') = ?)`)
              .run(session.id, row.id);
            const caches = this.database.prepare<[string, string], { id: string; record_json: string }>(`SELECT id, record_json FROM ui_sketch_png_splits
              WHERE session_id = ? AND EXISTS (SELECT 1 FROM json_each(record_json, '$.pieces') piece WHERE json_extract(piece.value, '$.assetId') = ?)`)
              .all(session.id, row.id);
            for (const cache of caches) {
              const record = JSON.parse(cache.record_json) as { pieces: { assetId: string | null }[] };
              for (const piece of record.pieces) if (piece.assetId === row.id) piece.assetId = null;
              this.database.prepare("UPDATE ui_sketch_png_splits SET record_json = ? WHERE id = ?").run(JSON.stringify(record), cache.id);
            }
            this.database.prepare("DELETE FROM image_assets WHERE id = ? AND deleting = 1").run(row.id);
            this.database.prepare("DELETE FROM storage_orphan_files WHERE relative_path = ?").run(row.relative_path);
          })();
          result.imagesDeleted++; result.bytesFreed += size;
        } catch {
          this.database.prepare("UPDATE image_assets SET deleting = 0 WHERE id = ?").run(row.id);
          result.failedFiles.push(row.relative_path);
        }
      }
      this.database.prepare("DELETE FROM ui_sketch_png_splits WHERE session_id = ? AND updated_at <= ?")
        .run(session.id, new Date(this.now() - settings.historyRetentionDays * 86_400_000).toISOString());
      await setImmediate();
    }
    // Includes legacy/crash leftovers and files whose session was removed by a cascade.
    if (!sessionId) await this.collectOrphanFiles(result);
    return result;
  }

  private async collectOrphanFiles(result: StorageCollectionResult): Promise<void> {
    const { imageRetentionDays } = new WorkspaceSettingsRepository(this.database).get();
    const referenced = new Set(this.database.prepare<[], { relative_path: string }>(`SELECT relative_path FROM image_assets
      UNION SELECT relative_path FROM style_reference_images UNION SELECT relative_path FROM style_preview_models`).all().map(row => row.relative_path));
    const known = this.database.prepare<[string, string, string], { relative_path: string }>(`SELECT relative_path FROM image_assets WHERE relative_path = ?
      UNION SELECT relative_path FROM style_reference_images WHERE relative_path = ? UNION SELECT relative_path FROM style_preview_models WHERE relative_path = ?`);
    const now = new Date(this.now()).toISOString();
    for (const path of await this.managedFiles()) {
      if (referenced.has(path)) {
        this.database.prepare("DELETE FROM storage_orphan_files WHERE relative_path = ?").run(path);
      } else {
        this.database.prepare("INSERT OR IGNORE INTO storage_orphan_files VALUES (?, ?)").run(path, now);
      }
    }
    const stale = this.database.prepare<[string], { relative_path: string }>(
      "SELECT relative_path FROM storage_orphan_files WHERE unreferenced_since <= ?").all(new Date(this.now() - imageRetentionDays * 86_400_000).toISOString());
    for (const row of stale) {
      if (!managedPath(row.relative_path)) continue;
      const file = join(this.root, row.relative_path), size = await fileSize(file);
      const id = row.relative_path.split(/[\\/]/).at(-1)!.split(".")[0];
      if (this.assets.isProtected(id)) {
        this.database.prepare("UPDATE storage_orphan_files SET unreferenced_since = ? WHERE relative_path = ?").run(now, row.relative_path);
        continue;
      }
      if (known.get(row.relative_path, row.relative_path, row.relative_path)) {
        this.database.prepare("DELETE FROM storage_orphan_files WHERE relative_path = ?").run(row.relative_path);
        continue;
      }
      try { await removeFile(file); } catch { result.failedFiles.push(row.relative_path); continue; }
      this.database.prepare("DELETE FROM storage_orphan_files WHERE relative_path = ?").run(row.relative_path);
      if (size > 0) { result.bytesFreed += size; if (!file.endsWith(".glb")) result.imagesDeleted++; }
    }
  }

  private async managedFiles(): Promise<string[]> {
    const files: string[] = [];
    for (const owner of await entries(this.root)) {
      if (!owner.isDirectory()) continue;
      if (owner.name === "styles") {
        for (const style of await entries(join(this.root, "styles"))) {
          if (!style.isDirectory()) continue;
          for (const file of await entries(join(this.root, "styles", style.name))) {
            const relative = join("styles", style.name, file.name);
            if (file.isFile() && managedPath(relative)) files.push(relative);
          }
        }
      } else {
        for (const file of await entries(join(this.root, owner.name, "source"))) {
          const relative = join(owner.name, "source", file.name);
          if (file.isFile() && managedPath(relative)) files.push(relative);
        }
      }
    }
    return files;
  }

  /** Only called while editing is idle. Convert older databases once, then reclaim small batches. */
  compact(): void {
    const pages = this.database.pragma("page_count", { simple: true }) as number;
    const free = this.database.pragma("freelist_count", { simple: true }) as number;
    const size = this.database.pragma("page_size", { simple: true }) as number;
    if (free * size < 8 * 1024 * 1024 || free < pages * 0.2) return;
    if (this.database.pragma("auto_vacuum", { simple: true }) !== 2) {
      this.database.pragma("auto_vacuum = INCREMENTAL");
      this.database.exec("VACUUM");
    } else this.database.pragma("incremental_vacuum(256)");
  }
}

function managedPath(path: string): boolean {
  return /^(?:[0-9a-f-]{36}\/source|styles\/[0-9a-f-]{36})\/[0-9a-f-]{36}\.(?:png|jpg|webp|svg|glb)$/.test(path.replaceAll("\\", "/"));
}
async function entries(path: string) {
  try { return await readdir(path, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
async function fileSize(path: string): Promise<number> {
  try { const stat = await lstat(path); if (!stat.isFile()) throw new InvalidRecordError("Managed image path is not a file."); return stat.size; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0; throw error; }
}
async function removeFile(path: string): Promise<void> {
  try { await unlink(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
