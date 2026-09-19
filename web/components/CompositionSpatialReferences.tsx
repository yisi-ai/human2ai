"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import { Alert, Modal, Select } from "antd";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import type { CompositionDraft, CompositionImage } from "../../src/domain/composition";
import { addCameraReference, refreshCameraReference, snapshotCameraReference } from "../../src/domain/composition/camera-reference";
import { createSpatialDraft, type SpatialCamera } from "../../src/domain/spatial";
import { imageAssetContentUrl, listSessions, listSpatialDraftVersions, spatialCameraUrl, uploadImageAsset, type Human2AiSession } from "../lib/human2ai-api";

export function useCompositionSpatialReferences(options: {
  draft: CompositionDraft; sessionId: string | null;
  ensureSession(): Promise<string>;
  updateDraft(action: SetStateAction<CompositionDraft>, returnToDraft?: boolean): void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const current = useRef(options); current.current = options;
  const [open, setOpen] = useState(false);
  const [spaces, setSpaces] = useState<Human2AiSession[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [cameras, setCameras] = useState<SpatialCamera[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true); setError(null);
    void listSessions().then(all => { if (!cancelled) setSpaces(all.filter(s => s.sessionType === "spatial")); })
      .catch(() => { if (!cancelled) setError(t("spatial.loadFailed")); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, attempt, t]);
  useEffect(() => {
    if (!open || !spaceId) return;
    let cancelled = false;
    setBusy(true); setError(null); setCameras([]); setCameraId(null);
    void listSpatialDraftVersions(spaceId).then(versions => {
      if (cancelled) return;
      const latest = versions.at(-1), next = latest?.draft.cameras ?? createSpatialDraft().cameras;
      setCameras(next); setCameraId(next[0]?.id ?? null); setSourceRevision(latest?.revision ?? 0);
    }).catch(() => { if (!cancelled) setError(t("spatial.loadFailed")); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [spaceId, open, attempt, t]);

  // Materialize each observed camera revision as an immutable composition-owned
  // image. Live references advance; PNG snapshots and composition history retain
  // their original asset even if the source scene is edited or deleted.
  useEffect(() => {
    const targetSessionId = options.sessionId;
    if (!targetSessionId) return;
    let cancelled = false, refreshing = false;
    setMissing(new Set());
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const sources = new Map<string, CompositionImage>();
        for (const image of current.current.draft.images) if (image.cameraReference) sources.set(`${image.cameraReference.sessionId}/${image.cameraReference.cameraId}`, image);
        const unavailable = new Set<string>();
        for (const [key, image] of sources) {
          if (cancelled) return;
          const reference = image.cameraReference!;
          try {
            const latest = (await listSpatialDraftVersions(reference.sessionId)).at(-1);
            const revision = latest?.revision ?? 0;
            const camera = (latest?.draft ?? createSpatialDraft()).cameras.find(c => c.id === reference.cameraId);
            if (!camera) { unavailable.add(key); continue; }
            if (revision === reference.renderedRevision && image.assetId) continue;
            const asset = await captureCamera(targetSessionId, reference.sessionId, camera, revision);
            if (cancelled) return;
            current.current.updateDraft(draft => refreshCameraReference(draft, {
              sessionId: reference.sessionId, cameraId: camera.id, revision, assetId: asset.id, width: camera.width, height: camera.height,
            }), false);
          } catch { unavailable.add(key); }
        }
        if (!cancelled) setMissing(unavailable);
      } finally { refreshing = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [options.sessionId]);

  async function captureCamera(targetSessionId: string, sourceSessionId: string, camera: SpatialCamera, revision: number) {
    const response = await fetch(spatialCameraUrl(sourceSessionId, camera.id, revision || undefined), { cache: "no-store" });
    if (!response.ok) throw new Error("SPATIAL_CAMERA_NOT_FOUND");
    return uploadImageAsset(targetSessionId, new File([await response.blob()], `${camera.id}.png`, { type: "image/png" }));
  }
  async function insert() {
    const camera = cameras.find(c => c.id === cameraId);
    if (!spaceId || !camera || busy) return;
    setBusy(true); setError(null);
    try {
      const owner = current.current.sessionId;
      const sessionId = await current.current.ensureSession();
      const asset = await captureCamera(sessionId, spaceId, camera, sourceRevision);
      if (current.current.sessionId !== sessionId && current.current.sessionId !== owner) return;
      current.current.updateDraft(draft => addCameraReference(draft, { sessionId: spaceId, cameraId: camera.id, revision: sourceRevision, assetId: asset.id, width: camera.width, height: camera.height }).draft);
      setOpen(false);
    } catch { setError(t("spatial.loadFailed")); }
    finally { setBusy(false); }
  }
  return {
    openPicker: () => { setSpaceId(null); setCameras([]); setCameraId(null); setOpen(true); },
    picker: <Modal closable={{ "aria-label": t("actions.cancel"), disabled: busy }} title={t("spatial.addReference")} open={open} onCancel={() => !busy && setOpen(false)} onOk={() => void insert()} confirmLoading={busy} okButtonProps={{ disabled: !cameraId || busy }} okText={t("actions.create")} cancelText={t("actions.cancel")} destroyOnHidden>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error && <Alert type="error" message={error} action={<BasicButton onClick={() => setAttempt(n => n + 1)}>{t("actions.retry")}</BasicButton>} />}
        <Select aria-label={t("spatial.selectSpace")} placeholder={t("spatial.selectSpace")} value={spaceId} loading={busy} options={spaces.map(s => ({ value: s.id, label: s.title }))} notFoundContent={t("spatial.noSpaces")} onChange={setSpaceId} />
        <Select aria-label={t("spatial.selectCamera")} placeholder={t("spatial.selectCamera")} value={cameraId} disabled={!spaceId || busy} options={cameras.map(c => ({ value: c.id, label: c.name }))} onChange={setCameraId} />
        {spaceId && cameraId && <img src={spatialCameraUrl(spaceId, cameraId, sourceRevision || undefined)} alt={t("spatial.cameraView")} style={{ width: "100%", maxHeight: 260, objectFit: "contain" }} />}
      </div>
    </Modal>,
    renderImageContent: (image: CompositionImage) => {
      const reference = image.cameraReference!;
      const unavailable = missing.has(`${reference.sessionId}/${reference.cameraId}`);
      return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <strong>{t("spatial.reference")}</strong>
        {unavailable && <Alert type="warning" message={t("spatial.sourceMissing")} />}
        {image.assetId && options.sessionId && <img src={imageAssetContentUrl(options.sessionId, image.assetId)} alt={t("spatial.cameraView")} style={{ width: "100%", maxHeight: 280, objectFit: "contain" }} />}
        <BasicButton disabled={unavailable} onClick={() => router.push(`/spatial?session=${encodeURIComponent(reference.sessionId)}&camera=${encodeURIComponent(reference.cameraId)}`)}>{t("spatial.openSource")}</BasicButton>
        <BasicButton disabled={!image.assetId} onClick={() => current.current.updateDraft(draft => snapshotCameraReference(draft, image.id).draft)}>{t("spatial.snapshot")}</BasicButton>
      </div>;
    },
  };
}
