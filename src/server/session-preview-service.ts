import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CompositionSessionRepository } from "../database/composition-session-repository.ts";
import type { UiSketchSessionRepository } from "../database/ui-sketch-session-repository.ts";
import type { SpatialSessionRepository } from "../database/spatial-session-repository.ts";
import type { ImageAssetRepository } from "../database/image-asset-repository.ts";
import { InvalidRecordError, type ProjectSessionRepository } from "../database/project-session-repository.ts";
import { compositionStates, selectCompositionState } from "../domain/composition/states.ts";
import { renderCompositionReferenceSvg } from "../domain/composition/render.ts";
import { renderUiSketchSvg } from "../domain/ui-sketch/render.ts";
import { uiSketchStateTabs, uiSketchDraftForStage, type UiSketchDraftVersion } from "../domain/ui-sketch/index.ts";
import { previewSourceKey, previewWaveGroups, type SessionPreviewSource } from "../domain/session/preview.ts";
import type { MaterializedSessionPreview } from "../domain/ui-sketch/session-preview.ts";

export interface SessionPreviewDependencies {
  projectSessions: ProjectSessionRepository;
  compositionSessions: CompositionSessionRepository;
  uiSketchSessions: UiSketchSessionRepository;
  spatialSessions: SpatialSessionRepository;
  imageAssets: ImageAssetRepository;
  renderCamera(sessionId: string, cameraId: string, revision: number): Promise<Buffer>;
  onError(error: unknown): void;
}

export class SessionPreviewService {
  private readonly drafts = new Map<string, UiSketchDraftVersion>();
  private readonly pending = new Map<string, number>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly unsubscribe: (() => void)[] = [];
  private readonly images = new Map<string, Promise<Buffer>>();
  private work?: Promise<void>;
  private closed = false;

  constructor(private readonly deps: SessionPreviewDependencies) {
    for (const session of deps.projectSessions.listSessions()) if (session.sessionType === "ui-layout") {
      const latest = deps.uiSketchSessions.getLatestDraftVersion(session.id);
      if (latest) this.drafts.set(session.id, latest);
    }
    this.unsubscribe.push(deps.uiSketchSessions.onDraftSaved(event => {
      this.drafts.set(event.version.sessionId, event.version);
      this.notify(event.version.sessionId);
      if (!event.previewBatchId) this.enqueue(event.version.sessionId, event.version.revision);
    }), deps.compositionSessions.onDraftSaved(({ version }) => this.enqueue(version.sessionId, version.revision)),
    deps.spatialSessions.onDraftSaved(({ version }) => this.enqueue(version.sessionId, version.revision)));
    // Refresh legacy 2D raster previews through the existing finite waves. Keep
    // old assets/versions immutable and skip already-vector or missing sources.
    const legacySources = new Map<string, SessionPreviewSource>();
    for (const version of this.drafts.values()) for (const image of version.draft.images) {
      if (!image.previewReference || image.previewReference.sessionType === "spatial" || !image.assetId) continue;
      try {
        if (deps.imageAssets.get(version.sessionId, image.assetId).asset.mimeType === "image/png") {
          legacySources.set(image.previewReference.sessionId, image.previewReference);
        }
      } catch { /* A missing asset must not prevent startup. */ }
    }
    for (const source of legacySources.values()) {
      try { this.enqueue(source.sessionId, this.latestRevision(source)); } catch { /* Retain deleted sources. */ }
    }
  }

  subscribe(id: string, listener: () => void) {
    const listeners = this.listeners.get(id) ?? new Set();
    listeners.add(listener); this.listeners.set(id, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(id); };
  }

  private notify(id: string) { this.listeners.get(id)?.forEach(listener => listener()); }

  invalidateMembership() {
    const existing = new Set(this.deps.projectSessions.listSessions().map(s => s.id));
    for (const id of this.drafts.keys()) if (!existing.has(id)) this.drafts.delete(id);
    for (const id of this.listeners.keys()) this.notify(id);
  }

  sources(ownerId: string) {
    const owner = this.deps.projectSessions.getSession(ownerId);
    if (owner.sessionType !== "ui-layout") throw new InvalidRecordError("Session previews belong to a UI session.");
    if (!owner.projectId) return [];
    return this.deps.projectSessions.listSessions().filter(s => s.id !== ownerId && s.projectId === owner.projectId).map(session => {
      if (session.sessionType === "spatial") {
        const version = this.deps.spatialSessions.getLatestDraftVersion(session.id);
        return { session, revision: version?.revision ?? 0, outputs: version?.draft.cameras.map(camera => ({ id: camera.id, name: camera.name })) ?? [] };
      }
      if (session.sessionType === "ui-layout") {
        const version = this.deps.uiSketchSessions.getLatestDraftVersion(session.id);
        return { session, revision: version?.revision ?? 0, outputs: version ? uiSketchStateTabs(version.draft) : [] };
      }
      const version = this.deps.compositionSessions.getLatestDraftVersion(session.id);
      return { session, revision: version?.revision ?? 0, outputs: version ? compositionStates(version.draft).map(({ id, name, number }) => ({ id, name, number })) : [] };
    });
  }

  private assertSource(ownerId: string, source: SessionPreviewSource) {
    const owner = this.deps.projectSessions.getSession(ownerId), session = this.deps.projectSessions.getSession(source.sessionId);
    if (owner.sessionType !== "ui-layout" || ownerId === source.sessionId || !owner.projectId
      || owner.projectId !== session.projectId || source.sessionType !== session.sessionType) {
      throw new InvalidRecordError("A session preview requires another session in the same project.");
    }
  }

  private latestRevision(source: SessionPreviewSource) {
    const repository = source.sessionType === "spatial" ? this.deps.spatialSessions
      : source.sessionType === "ui-layout" ? this.deps.uiSketchSessions : this.deps.compositionSessions;
    const version = repository.getLatestDraftVersion(source.sessionId);
    if (!version) throw new InvalidRecordError("Save the source session before referencing it.");
    return version.revision;
  }

  async render(ownerId: string, source: SessionPreviewSource, revision = this.latestRevision(source)) {
    this.assertSource(ownerId, source);
    const vector = source.sessionType !== "spatial";
    let key: string, create: () => Promise<Buffer>;
    if (source.sessionType === "spatial") {
      key = JSON.stringify([previewSourceKey(source), revision]);
      create = () => this.deps.renderCamera(source.sessionId, source.cameraId, revision);
    } else {
      let draft;
      if (source.sessionType === "ui-layout") {
        const version = this.deps.uiSketchSessions.getDraftVersion(source.sessionId, revision);
        if (!uiSketchStateTabs(version.draft).some(s => s.id === source.stateId)) throw new InvalidRecordError("The selected state no longer exists.");
        draft = uiSketchDraftForStage(version.draft, source.stateId);
      } else {
        draft = selectCompositionState(this.deps.compositionSessions.getDraftVersion(source.sessionId, revision).draft, source.stateId);
      }
      const assets = new Map<string, string>();
      await Promise.all([...new Set(draft.images.flatMap(image => image.assetId && image.visible !== false ? [image.assetId] : []))].map(async id => {
        const { asset, filePath } = this.deps.imageAssets.get(source.sessionId, id);
        assets.set(id, `data:${asset.mimeType};base64,${(await readFile(filePath)).toString("base64")}`);
      }));
      const svg = draft.kind === "ui-layout-draft" ? renderUiSketchSvg(draft, id => assets.get(id)) : renderCompositionReferenceSvg(draft, id => assets.get(id));
      key = createHash("sha256").update(svg).digest("hex");
      create = () => Promise.resolve(Buffer.from(svg));
    }
    let pending = this.images.get(key);
    if (!pending) {
      pending = create().catch(error => { this.images.delete(key); throw error; });
      this.images.set(key, pending);
      if (this.images.size > 24) this.images.delete(this.images.keys().next().value!);
    }
    return { data: await pending, mimeType: vector ? "image/svg+xml" : "image/png", extension: vector ? "svg" : "png", revision };
  }

  async materialize(ownerId: string, source: SessionPreviewSource): Promise<MaterializedSessionPreview> {
    const { data, extension, revision } = await this.render(ownerId, source);
    this.assertSource(ownerId, source);
    const asset = await this.deps.imageAssets.create(ownerId, { filename: `session-preview.${extension}`, data });
    return { assetId: asset.id, width: asset.width, height: asset.height, reference: { ...source, renderedRevision: revision } };
  }

  private enqueue(id: string, revision: number) {
    if (this.closed) return;
    this.pending.set(id, revision);
    if (!this.work) this.work = this.drain().finally(() => {
      this.work = undefined;
      const next = this.pending.entries().next().value;
      if (next) this.enqueue(...next);
    });
  }

  private async drain() {
    while (this.pending.size && !this.closed) {
      const [root, revision] = this.pending.entries().next().value!;
      this.pending.delete(root);
      try { await this.refreshWave(root, revision); } catch (error) { this.deps.onError(error); }
    }
  }

  private async refreshWave(root: string, rootRevision: number) {
    const batchId = randomUUID();
    const dependencies = new Map([...this.drafts].map(([id, version]) => [id, version.draft.images.flatMap(i => i.previewReference ? [i.previewReference.sessionId] : [])]));
    const groups = previewWaveGroups(root, dependencies);
    const changed = new Set([root]);
    for (const group of groups) {
      if (this.closed) return;
      if (!group.some(id => (dependencies.get(id) ?? []).some(source => changed.has(source)))) continue;
      // Freeze all source revisions before refreshing a cyclic group. No recursive
      // rendering: its nested previews are already immutable source-owned assets.
      const revisions = new Map<string, number>([[root, rootRevision]]);
      for (const id of group) for (const image of this.drafts.get(id)?.draft.images ?? []) {
        const ref = image.previewReference;
        if (ref && !revisions.has(ref.sessionId)) {
          try { revisions.set(ref.sessionId, this.latestRevision(ref)); } catch { /* Retain missing sources. */ }
        }
      }
      for (const id of group) {
        const initial = this.drafts.get(id);
        if (!initial) continue;
        const updates = new Map<string, MaterializedSessionPreview>();
        const checked = new Set<string>();
        for (const image of initial.draft.images) {
          const ref = image.previewReference, revision = ref && revisions.get(ref.sessionId);
          if (!ref || !revision || checked.has(previewSourceKey(ref))) continue;
          if (!changed.has(ref.sessionId) && !group.includes(ref.sessionId)) continue;
          checked.add(previewSourceKey(ref));
          try {
            const { data, extension } = await this.render(id, ref, revision);
            const sha = createHash("sha256").update(data).digest("hex");
            const matches = initial.draft.images.filter(item => item.previewReference && previewSourceKey(item.previewReference) === previewSourceKey(ref));
            if (matches.every(item => item.assetId && this.deps.imageAssets.get(id, item.assetId).asset.sha256 === sha)) continue;
            this.assertSource(id, ref);
            const asset = await this.deps.imageAssets.create(id, { filename: `session-preview.${extension}`, data });
            updates.set(previewSourceKey(ref), { assetId: asset.id, width: asset.width, height: asset.height, reference: { ...ref, renderedRevision: revision } });
          } catch { this.notify(id); /* Retain the last successful image. */ }
        }
        if (!updates.size || this.closed) continue;
        const latest = this.deps.uiSketchSessions.getLatestDraftVersion(id);
        if (!latest) continue;
        let updated = false;
        const images = latest.draft.images.map(image => {
          const update = image.previewReference && updates.get(previewSourceKey(image.previewReference));
          if (!update || image.previewReference!.renderedRevision > update.reference.renderedRevision) return image;
          try { this.assertSource(id, update.reference); } catch { return image; }
          updated = true;
          return { ...image, assetId: update.assetId, previewReference: update.reference };
        });
        if (updated) {
          const version = this.deps.uiSketchSessions.refreshPreviewVersion(id, { expectedLatestRevision: latest.revision, draft: { ...latest.draft, images } }, batchId);
          this.drafts.set(id, version); changed.add(id);
        }
      }
    }
  }

  async close() {
    this.closed = true; this.unsubscribe.forEach(unsubscribe => unsubscribe());
    await this.work; this.listeners.clear(); this.images.clear();
  }
}
