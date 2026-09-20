import { spatialDraftFingerprint, type SpatialDraft, type SpatialOperation } from "../../src/domain/spatial";

interface SavedDraft { draft: SpatialDraft; revision: number; createdAt: string }
interface SpatialTransport {
  saveInitial(draft: SpatialDraft): Promise<SavedDraft>;
  apply(revision: number, operations: SpatialOperation[]): Promise<SavedDraft>;
  restore(revision: number, targetRevision: number): Promise<SavedDraft>;
}

/** Every operation snapshot is saved before a subsequent undo/redo can reference it. */
export class SpatialEditQueue {
  private jobs: Array<{ operation?: SpatialOperation; draft: SpatialDraft }> = [];
  private revisions = new Map<string, number>();
  private initial: SpatialDraft;
  busy = false;

  constructor(public draft: SpatialDraft, public revision: number) {
    this.initial = draft;
    if (revision > 0) this.revisions.set(spatialDraftFingerprint(draft), revision);
  }

  get pending(): boolean { return this.jobs.length > 0; }

  edit(operation: SpatialOperation, draft: SpatialDraft): void {
    this.draft = draft;
    this.jobs.push({ operation, draft });
  }

  restore(draft: SpatialDraft): void {
    this.draft = draft;
    this.jobs.push({ draft });
  }

  async flush(transport: SpatialTransport, onSaved: (saved: SavedDraft) => void): Promise<void> {
    if (this.busy || !this.pending) return;
    this.busy = true;
    try {
      if (this.revision === 0) {
        const saved = await transport.saveInitial(this.initial);
        this.remember(this.initial, saved);
      }
      while (this.jobs.length) {
        const job = this.jobs[0];
        let saved: SavedDraft;
        if (job.operation) saved = await transport.apply(this.revision, [job.operation]);
        else {
          const target = this.revisions.get(spatialDraftFingerprint(job.draft));
          if (target === undefined) throw new Error("Missing saved spatial history snapshot");
          saved = await transport.restore(this.revision, target);
        }
        this.remember(job.draft, saved);
        this.jobs.shift();
        if (!this.pending) this.draft = saved.draft;
        onSaved(saved);
      }
    } finally { this.busy = false; }
  }

  private remember(source: SpatialDraft, saved: SavedDraft): void {
    this.revision = saved.revision;
    // Keep the first stored copy; later restores must not turn history into a two-state toggle.
    for (const fingerprint of [spatialDraftFingerprint(source), spatialDraftFingerprint(saved.draft)]) {
      if (!this.revisions.has(fingerprint)) this.revisions.set(fingerprint, saved.revision);
    }
  }
}
