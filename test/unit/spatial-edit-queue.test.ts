import { describe, expect, it } from "vitest";
import { createSpatialDraft, applySpatialOperations, type SpatialOperation } from "../../src/domain/spatial/index.ts";
import { SpatialEditQueue } from "../../web/lib/spatial-edit-queue.ts";

describe("spatial editor save queue", () => {
  it("serializes edits, undo and redo even when an older save completes late", async () => {
    const initial = createSpatialDraft();
    const queue = new SpatialEditQueue(initial, 0);
    const operation: SpatialOperation = { type: "set-lighting", enabled: true };
    const changed = applySpatialOperations(initial, [operation]).draft;
    let release!: () => void;
    const pause = new Promise<void>(resolve => { release = resolve; });
    const versions = [initial];
    const calls: string[] = [];
    const saved = (draft: typeof initial) => {
      versions.push(draft);
      return { draft, revision: versions.length - 1, createdAt: "now" };
    };
    queue.edit(operation, changed);
    const writing = queue.flush({
      saveInitial: async draft => { calls.push("initial"); await pause; return saved(draft); },
      apply: async (revision, operations) => {
        calls.push(`edit:${revision}`);
        return saved(applySpatialOperations(versions[revision], operations).draft);
      },
      restore: async (revision, target) => { calls.push(`restore:${revision}:${target}`); return saved(versions[target]); },
    }, () => undefined);
    queue.restore(initial);
    expect(queue.draft).toEqual(initial);
    release();
    await writing;
    expect(calls).toEqual(["initial", "edit:1", "restore:2:1"]);
    expect(queue.draft).toEqual(initial);
    expect(queue.pending).toBe(false);
    queue.restore(changed);
    await queue.flush({
      saveInitial: async () => { throw new Error("already saved"); },
      apply: async () => { throw new Error("no edit queued"); },
      restore: async (revision, target) => { expect([revision, target]).toEqual([3, 2]); return saved(versions[target]); },
    }, () => undefined);
    expect(queue.draft).toEqual(changed);
  });

  it("keeps a failed operation queued and preserves newer local edits", async () => {
    const initial = createSpatialDraft();
    const queue = new SpatialEditQueue(initial, 1);
    const changed = { ...initial, lightingEnabled: true };
    queue.edit({ type: "set-lighting", enabled: true }, changed);
    await expect(queue.flush({
      saveInitial: async () => { throw new Error("unexpected"); },
      apply: async () => { queue.restore(initial); throw new Error("conflict"); },
      restore: async () => { throw new Error("must not pass failed edit"); },
    }, () => undefined)).rejects.toThrow("conflict");
    expect(queue.pending).toBe(true);
    expect(queue.busy).toBe(false);
    expect(queue.revision).toBe(1);
    expect(queue.draft).toEqual(initial);
  });
});
