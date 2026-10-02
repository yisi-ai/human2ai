export const HISTORY_VERSION_LIMIT = 100;
export const STORAGE_PROTECTION_MS = 3 * 60_000;
export const MAX_RETENTION_DAYS = 3650;
export const RETENTION_DEFAULTS = { imageRetentionDays: 1, historyRetentionDays: 7, trashRetentionDays: 7 } as const;

export interface RetentionSettings {
  imageRetentionDays: number;
  historyRetentionDays: number;
  trashRetentionDays: number;
}
export interface WorkspaceSettings extends RetentionSettings {
  revision: number;
}

export interface StorageProtection {
  revisions: number[];
  assetIds: string[];
}

/** Image content belongs to the root nodes; state layouts and split provenance do not own files. */
export function draftImageAssetIds(draft: unknown): string[] {
  const images = (draft as { images?: { assetId?: string | null }[] }).images;
  return [...new Set(images?.flatMap(image => image.assetId ? [image.assetId] : []) ?? [])];
}
