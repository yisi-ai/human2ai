import { useEffect, useMemo } from "react";
import { draftImageAssetIds } from "../../src/domain/session/storage";
import { createStorageProtection } from "./storage-protection";

export function useStorageProtection<T extends object>(sessionId: string | null, history: { retainedDrafts(): T[] }) {
  const protection = useMemo(() => {
    if (!sessionId) return undefined;
    // History snapshots are immutable. Each is inspected once and becomes collectable
    // when it leaves both undo and redo, including grouped text/gesture replacements.
    const cache = new WeakMap<T, string[]>();
    return createStorageProtection(sessionId, () => ({ revisions: [], assetIds: [...new Set(history.retainedDrafts().flatMap(draft => {
      let ids = cache.get(draft);
      if (!ids) { ids = draftImageAssetIds(draft); cache.set(draft, ids); }
      return ids;
    }))] }));
  }, [sessionId, history.retainedDrafts]);
  useEffect(() => {
    protection?.start();
    return () => { void protection?.close(); };
  }, [protection]);
  return protection;
}
