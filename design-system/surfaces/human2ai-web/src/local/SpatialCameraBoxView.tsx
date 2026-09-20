"use client";

import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { Alert, Select } from "antd";
import { useEffect, useState } from "react";
import { BasicButton } from "../vendor/yisiui/runtime/src/components/BasicButton";
import { LoadingState } from "../vendor/yisiui/runtime/src/components/LoadingState";
import { TabSwitch } from "../vendor/yisiui/runtime/src/components/TabSwitch";
import { SPATIAL_BOX_FACES, type SpatialBoxFace, type SpatialCameraBox, type SpatialRenderPass } from "../../../../../src/domain/spatial/types";
import type { SpatialLabels, SpatialWorkspaceViewProps } from "./SpatialWorkspaceView";
import { renderSpatialObservationImage } from "./spatialObservationImage";
import { saveImageFile } from "./saveImageFile";

// Back-facing polygons are drawn first so they remain visible through the front faces.
const cubeFaces: { face: SpatialBoxFace; points: string; rear?: boolean }[] = [
  { face: "back", points: "42,8 73,24 73,60 42,44", rear: true },
  { face: "left", points: "11,26 42,8 42,44 11,62", rear: true },
  { face: "bottom", points: "11,62 42,44 73,60 42,78", rear: true },
  { face: "top", points: "42,8 73,24 42,42 11,26" },
  { face: "front", points: "11,26 42,42 42,78 11,62" },
  { face: "right", points: "42,42 73,24 73,60 42,78" },
];
const faceButtonGroups: SpatialBoxFace[][] = [["front", "back"], ["left", "right"], ["top", "bottom"]];

interface SpatialCameraBoxViewProps {
  active: boolean;
  boxes: readonly SpatialCameraBox[];
  selectedBoxId?: string;
  onSelectBox(id: string): void;
  pass: SpatialRenderPass;
  onPassChange(pass: SpatialRenderPass): void;
  source: SpatialWorkspaceViewProps["cameraBoxSource"];
  labels: SpatialLabels;
  copiedLabel: string;
  retryLabel: string;
  disabled?: boolean;
}

export function SpatialCameraBoxView({ active, boxes, selectedBoxId, onSelectBox, pass, onPassChange, source, labels, copiedLabel, retryLabel, disabled }: SpatialCameraBoxViewProps) {
  const [faces, setFaces] = useState<readonly SpatialBoxFace[]>(SPATIAL_BOX_FACES);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<{ key: string; blob: Blob; url: string } | { key: string; error: true } | null>(null);
  const [exporting, setExporting] = useState<"copy" | "download" | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; message: string; error: boolean } | null>(null);
  const box = boxes.find(item => item.id === selectedBoxId) ?? boxes[0];
  const faceLabel = (face: SpatialBoxFace, compact = false) => labels[`cameraBox${face[0].toUpperCase()}${face.slice(1)}${compact ? "Toggle" : ""}` as keyof SpatialLabels];
  const passLabel = pass === "color" ? labels.referenceColor : pass === "structure" ? labels.referenceStructure : pass === "depth" ? labels.referenceDepth : labels.referenceSkeleton;
  const views = active && box ? faces.map(face => ({ face, source: source?.(box.id, face, pass), label: faceLabel(face) })) : [];
  // A stable request also discards late results when the box, revision, type or faces change.
  const request = views.length && views.every(view => view.source) ? JSON.stringify({ boxId: box.id, pass, resolution: box.resolution, views, attempt }) : null;
  const ready = preview?.key === request && "blob" in preview ? preview : null;
  const failed = preview?.key === request && "error" in preview;
  const notice = feedback?.key === request ? feedback : null;

  useEffect(() => {
    setPreview(null);
    if (!request) return;
    let cancelled = false;
    let url: string | undefined;
    const snapshot = JSON.parse(request) as { views: { face: SpatialBoxFace; source: string; label: string }[]; resolution: number };
    void renderSpatialObservationImage(snapshot.views, snapshot.resolution).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setPreview({ key: request, blob, url });
    }).catch(() => {
      if (!cancelled) setPreview({ key: request, error: true });
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [request]);

  const exportImage = async (action: "copy" | "download") => {
    if (!ready || !box || disabled || exporting) return;
    setExporting(action);
    setFeedback(null);
    try {
      if (action === "copy") {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("image-clipboard-unavailable");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": ready.blob })]);
        setFeedback({ key: ready.key, message: copiedLabel, error: false });
      } else {
        await saveImageFile(new File([ready.blob], `${box.id}-${pass}-${faces.join("-")}.png`, { type: "image/png" }));
      }
    } catch {
      setFeedback({ key: ready.key, message: action === "copy" ? labels.observationCopyFailed : labels.observationDownloadFailed, error: true });
    } finally { setExporting(null); }
  };

  if (!active) return null;
  return <section className="spatial-observation" aria-label={labels.cameraBoxTab}>
    <div className="spatial-observation-toolbar">
      <Select className="spatial-observation-select" aria-label={labels.cameraBoxTab} placeholder={labels.cameraBoxTab} value={box?.id} disabled={disabled || !box}
        options={boxes.map(item => ({ value: item.id, label: item.name }))} onChange={onSelectBox} />
      <TabSwitch aria-label={labels.referencePass} value={pass} onChange={value => onPassChange(value as SpatialRenderPass)} items={[
        { key: "color", label: labels.referenceColor, mode: "text-only", disabled: disabled || !box },
        { key: "structure", label: labels.referenceStructure, mode: "text-only", disabled: disabled || !box },
        { key: "depth", label: labels.referenceDepth, mode: "text-only", disabled: disabled || !box },
        { key: "skeleton", label: labels.referenceSkeleton, mode: "text-only", disabled: disabled || !box },
      ]} />
      <div className="spatial-observation-directions" role="group" aria-label={labels.cameraBoxView}>
        <svg className="spatial-observation-cube" viewBox="0 0 84 86" aria-hidden="true">
          {cubeFaces.map(({ face, points, rear }) => <polygon key={face} points={points} data-face={face} data-enabled={Boolean(box && faces.includes(face))} data-rear={rear || undefined} />)}
        </svg>
        <div className="spatial-observation-face-buttons">
          {faceButtonGroups.flatMap((group, groupIndex) => group.map((face, faceIndex) => {
            const active = Boolean(box && faces.includes(face));
            return <BasicButton key={face} className="spatial-observation-face-button" size="small"
              style={{ gridRow: faceIndex + 1, gridColumn: `${groupIndex * 2 + faceIndex + 1} / span 2` }}
              aria-label={faceLabel(face)} aria-pressed={active} disabled={disabled || !box}
              backgroundColor={active ? "color.action.primary" : "color.surface.soft"} textColor={active ? "color.text.inverse" : "color.text.secondary"}
              onClick={() => setFaces(current => SPATIAL_BOX_FACES.filter(item => item === face ? !current.includes(face) : current.includes(item)))}>
              {faceLabel(face, true)}
            </BasicButton>;
          }))}
        </div>
      </div>
    </div>
    <div className="spatial-observation-preview" aria-busy={Boolean(request && !ready && !failed)}>
      {!box ? <p className="spatial-camera-pending">{labels.noCameraBoxes}</p>
        : !faces.length ? <p className="spatial-camera-pending">{labels.noObservationDirections}</p>
        : !request ? <p className="spatial-camera-pending">{labels.cameraPreviewPending}</p>
        : failed ? <Alert type="error" message={labels.referenceLoadFailed} action={<BasicButton size="small" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>{retryLabel}</BasicButton>} />
        : ready ? <img src={ready.url} alt={`${box.name} · ${passLabel} · ${views.map(view => view.label).join(" / ")}`} />
        : <LoadingState label={passLabel} rows={3} />}
    </div>
    {notice && (notice.error ? <Alert type="error" message={notice.message} /> : <p className="spatial-observation-status" role="status">{notice.message}</p>)}
    <div className="spatial-observation-actions">
      <BasicButton mode="with-icon" icon={<CopyOutlined aria-hidden="true" />} loading={exporting === "copy"} disabled={disabled || !ready || Boolean(exporting)} onClick={() => void exportImage("copy")}>{labels.copyObservationImage}</BasicButton>
      <BasicButton mode="with-icon" icon={<DownloadOutlined aria-hidden="true" />} loading={exporting === "download"} disabled={disabled || !ready || Boolean(exporting)} onClick={() => void exportImage("download")}>{labels.downloadObservationImage}</BasicButton>
    </div>
  </section>;
}
