import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { DatabaseConnection } from "./migrate.ts";
import { ImageAssetRepository, ImageAssetNotFoundError, InvalidImageAssetError } from "./image-asset-repository.ts";
import { splitTransparentPng, previewTransparentPng, partitionPngPieces, SPLIT_ALGORITHM, MANUAL_SPLIT_ALGORITHM } from "../domain/ui-sketch/transparent-png.ts";
import { PACKING_ALGORITHM } from "../domain/ui-sketch/png-canvas.ts";
import type { PngSplitBatch, PngSplitOptions, PngSplitSource, PngSplitPreview } from "../domain/ui-sketch/png-split.ts";

const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

export class UiSketchPngSplitRepository {
  private readonly pending = new Map<string, Promise<PngSplitBatch>>();

  constructor(private readonly database: DatabaseConnection, private readonly assets: ImageAssetRepository) {}

  async preview(sessionId: string, sources: PngSplitSource[], options: PngSplitOptions): Promise<PngSplitPreview> {
    return this.assets.withProtection(sources.map(source => source.assetId), async () => {
      const previews: PngSplitPreview["sources"] = [];
      for (const source of [...sources].sort((a, b) => a.nodeId.localeCompare(b.nodeId))) {
        const { asset, filePath } = this.assets.get(sessionId, source.assetId);
        if (asset.mimeType !== "image/png") throw new InvalidImageAssetError("PNG splitting requires transparent PNG images.");
        const bytes = await readFile(filePath);
        if (digest(bytes) !== asset.sha256) throw new InvalidImageAssetError("Source PNG content changed.");
        try {
          const preview = await previewTransparentPng(bytes, { ...options, regions: source.regions });
          const { kept, discarded } = partitionPngPieces(preview.pieces, options.minSize);
          previews.push({ nodeId: source.nodeId, width: preview.width, height: preview.height,
            discarded: discarded.length, rects: kept.map(piece => piece.sourceRect) });
        } catch (error) {
          throw new InvalidImageAssetError(error instanceof Error ? error.message : "Invalid transparent PNG.");
        }
      }
      return { sources: previews };
    });
  }

  async prepare(sessionId: string, sources: PngSplitSource[], options: PngSplitOptions): Promise<PngSplitBatch> {
    return this.assets.withProtection(sources.map(source => source.assetId), () => this.prepareProtected(sessionId, sources, options));
  }

  private async prepareProtected(sessionId: string, sources: PngSplitSource[], options: PngSplitOptions): Promise<PngSplitBatch> {
    const batches: PngSplitBatch[] = [];
    // Selection order does not affect identity, retries or packing.
    for (const source of [...sources].sort((a, b) => a.nodeId.localeCompare(b.nodeId))) {
      const { asset, filePath } = this.assets.get(sessionId, source.assetId);
      if (asset.mimeType !== "image/png") throw new InvalidImageAssetError("PNG splitting requires transparent PNG images.");
      const id = digest(JSON.stringify([sessionId, source.nodeId, source.assetId, asset.sha256, SPLIT_ALGORITHM,
        options.alphaThreshold, options.minSize, ...(source.regions?.length ? [MANUAL_SPLIT_ALGORITHM, source.regions] : [])]));
      let pending = this.pending.get(id);
      if (!pending) {
        pending = this.prepareSource(id, sessionId, source, asset.sha256, filePath, options);
        this.pending.set(id, pending);
      }
      try { batches.push(await pending); }
      finally { if (this.pending.get(id) === pending) this.pending.delete(id); }
    }
    const id = digest(JSON.stringify(batches.map(batch => batch.id)));
    const pieces = batches.flatMap(batch => batch.pieces);
    return { id, algorithm: sources.some(source => source.regions?.length) ? MANUAL_SPLIT_ALGORITHM : SPLIT_ALGORITHM, packingAlgorithm: PACKING_ALGORITHM, options,
      sources: batches.flatMap(batch => batch.sources), pieces, groupId: pieces.length >= 2 ? `png-group-${id}` : null };
  }

  private async prepareSource(id: string, sessionId: string, source: PngSplitSource, sha256: string,
    filePath: string, options: PngSplitOptions): Promise<PngSplitBatch> {
    const row = this.database.prepare<[string], { record_json: string }>(
      "SELECT record_json FROM ui_sketch_png_splits WHERE id = ?",
    ).get(id);
    let record: PngSplitBatch | undefined = row ? JSON.parse(row.record_json) : undefined;
    if (record) {
      for (const piece of record.pieces) if (piece.assetId) {
        try { this.assets.get(sessionId, piece.assetId); }
        catch (error) { if (error instanceof ImageAssetNotFoundError) piece.assetId = null; else throw error; }
      }
      // A reused slice is being handed to a new placement; restart its upload grace.
      this.database.prepare("UPDATE image_assets SET unreferenced_since = NULL WHERE session_id = ? AND id IN (SELECT value FROM json_each(?))")
        .run(sessionId, JSON.stringify(record.pieces.flatMap(piece => piece.assetId ? [piece.assetId] : [])));
    }
    if (record && record.pieces.every(piece => piece.assetId)) {
      this.database.prepare("UPDATE ui_sketch_png_splits SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
      return record;
    }
    const bytes = await readFile(filePath);
    if (digest(bytes) !== sha256) throw new InvalidImageAssetError("Source PNG content changed.");
    let split;
    try { split = await splitTransparentPng(bytes, { ...options, regions: source.regions }); }
    catch (error) {
      throw new InvalidImageAssetError(error instanceof Error ? error.message : "Invalid transparent PNG.");
    }
    const { kept, discarded } = partitionPngPieces(split.pieces, options.minSize);
    const persist = () => this.database.prepare(
      "INSERT INTO ui_sketch_png_splits (id, session_id, record_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, updated_at = excluded.updated_at",
    ).run(id, sessionId, JSON.stringify(record), new Date().toISOString());
    if (!record) {
      record = { id, algorithm: split.algorithm, packingAlgorithm: PACKING_ALGORITHM, options,
        sources: [{ ...source, sha256, width: split.width, height: split.height, discarded: discarded.length }],
        pieces: kept.map((piece, index) => ({ nodeId: `png-${id}-${index}`, assetId: null, sourceNodeId: source.nodeId,
          sourceRect: piece.sourceRect, sha256: digest(piece.png), width: piece.width, height: piece.height })), groupId: null };
      persist();
    }
    for (const [index, piece] of record.pieces.entries()) {
      if (piece.assetId) continue;
      const png = kept[index]?.png;
      if (!png || digest(png) !== piece.sha256) throw new InvalidImageAssetError("PNG retry content changed.");
      piece.assetId = (await this.assets.create(sessionId, { filename: `${piece.nodeId}.png`, data: png })).id;
      persist();
    }
    return record;
  }
}
