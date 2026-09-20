"use client";

import { CodeOutlined, CopyOutlined, DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { ActionButton } from "@human2ai/ui/yisiui/action-button";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { Human2AiCanvasImageCrop } from "../../../../../src/domain/canvas-node-metadata";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import { getClipboardImage } from "./clipboardImage";
import { saveImageFile } from "./saveImageFile";

import "./CanvasImageEditorFields.css";

export interface CanvasImageEditorLabels {
  content: string;
  upload: string;
  download: string;
  downloading: string;
  downloadFailed: string;
  replace: string;
  uploading: string;
  uploadFailed: string;
  fileTypes: string;
  cropTitle: string;
  cropLoadFailed: string;
  svgSource: string;
  svgPaste: string;
  svgApply: string;
  svgSaveFailed: string;
  svgCopy: string;
  svgCopying: string;
  svgCopied: string;
  svgCopyFailed: string;
  sourceLoading: string;
  sourceLoadFailed: string;
  cancel: string;
  retry: string;
}

export interface CanvasImageEditorFieldsProps {
  src?: string;
  crop: Human2AiCanvasImageCrop | null;
  aspectRatio: number;
  labels: CanvasImageEditorLabels;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
  onReadFile?: (src: string) => Promise<File>;
  onCropChange: (crop: Human2AiCanvasImageCrop, aspectRatio: number) => void;
}

interface ImageSize {
  width: number;
  height: number;
}

type CropHandle = "north-west" | "north-east" | "south-east" | "south-west";

interface CropGesture {
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCrop: Human2AiCanvasImageCrop;
  handle?: CropHandle;
}

const MINIMUM_CROP_SIZE = 0.05;
const KEYBOARD_CROP_STEP = 0.01;

export function CanvasImageEditorFields({
  src,
  crop,
  aspectRatio,
  labels,
  disabled = false,
  onUpload,
  onReadFile,
  onCropChange,
}: CanvasImageEditorFieldsProps) {
  const rootRef = useRef<HTMLElement>(null);
  const uploadingRef = useRef(false);
  const downloadingRef = useRef(false);
  const contentLabelId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const cropRef = useRef<Human2AiCanvasImageCrop | null>(null);
  const gestureRef = useRef<CropGesture | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [draftCrop, setDraftCrop] = useState<Human2AiCanvasImageCrop | null>(null);
  const [svgSource, setSvgSource] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ src: string; file: File } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceLoadFailed, setSourceLoadFailed] = useState(false);
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [svgInputOpen, setSvgInputOpen] = useState(false);
  const [svgInput, setSvgInput] = useState("");
  const sourceId = `${contentLabelId}-source`;

  useLayoutEffect(() => {
    setSvgInputOpen(false);
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    setSvgSource(null);
    setImageFile(null);
    setDownloadError(null);
    setSourceLoadFailed(false);
    setSourceLoading(Boolean(src && onReadFile));
    if (src && onReadFile) {
      void onReadFile(src)
        .then(async (file) => {
          const source = file.type === "image/svg+xml" ? await file.text() : null;
          if (!cancelled) {
            setImageFile({ src, file });
            setSvgSource(source);
          }
        })
        .catch(() => { if (!cancelled) setSourceLoadFailed(true); })
        .finally(() => { if (!cancelled) setSourceLoading(false); });
    }
    return () => { cancelled = true; };
  }, [onReadFile, sourceAttempt, src]);

  useLayoutEffect(() => {
    setImageSize(null);
    setImageLoadFailed(false);
    setDraftCrop(null);
    cropRef.current = null;
    gestureRef.current = null;
  }, [src]);

  useEffect(() => {
    if (!src || !imageSize) return;
    const next = crop ? { ...crop } : centeredCrop(baseCrop(imageSize, aspectRatio));
    cropRef.current = next;
    setDraftCrop(next);
  }, [aspectRatio, crop, imageSize, src]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scope = root.closest('[role="dialog"]') ?? root;
    const document = root.ownerDocument;
    function handlePaste(paste: ClipboardEvent): void {
      if (paste.defaultPrevented || !paste.clipboardData || disabled) return;
      const target = paste.target === document.body ? document.activeElement : paste.target;
      if (!(target instanceof Node) || !scope.contains(target)) return;
      const file = getClipboardImage(paste.clipboardData);
      if (!file) return;
      paste.preventDefault();
      paste.stopPropagation();
      void handleFile(file);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  });

  async function handleFile(file: File): Promise<boolean> {
    if (disabled || uploadingRef.current) return false;
    uploadingRef.current = true;
    setUploading(true);
    setUploadError(false);
    try {
      await onUpload(file);
      return true;
    } catch {
      setUploadError(true);
      return false;
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(): Promise<void> {
    if (!src || imageFile?.src !== src || uploadingRef.current || downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);
    setDownloadError(null);
    try {
      await saveImageFile(imageFile.file);
    } catch {
      setDownloadError(src);
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  }

  function updateDraftCrop(next: Human2AiCanvasImageCrop): void {
    cropRef.current = next;
    setDraftCrop(next);
  }

  function beginGesture(
    event: ReactPointerEvent<HTMLElement>,
    mode: CropGesture["mode"],
    handle?: CropHandle,
    startCrop = cropRef.current,
  ): void {
    if (disabled || !startCrop || !imageSize) return;
    gestureRef.current = {
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop,
      handle,
    };
    event.currentTarget
      .closest<HTMLElement>("[data-crop-selection]")
      ?.focus({ preventScroll: true });
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events do not always create a capturable browser pointer.
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function beginPreviewGesture(event: ReactPointerEvent<HTMLDivElement>): void {
    const bounds = previewRef.current?.getBoundingClientRect();
    const current = cropRef.current;
    if (disabled || !bounds || !current) return;
    const x = clamp(
      (event.clientX - bounds.left) / bounds.width - current.width / 2,
      0,
      1 - current.width,
    );
    const y = clamp(
      (event.clientY - bounds.top) / bounds.height - current.height / 2,
      0,
      1 - current.height,
    );
    const next = { ...current, x, y };
    updateDraftCrop(next);
    beginGesture(event, "move", undefined, next);
  }

  function moveGesture(event: ReactPointerEvent<HTMLDivElement>): void {
    const gesture = gestureRef.current;
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!gesture || gesture.pointerId !== event.pointerId || !bounds) return;
    const deltaX = (event.clientX - gesture.startClientX) / bounds.width;
    const deltaY = (event.clientY - gesture.startClientY) / bounds.height;
    updateDraftCrop(
      gesture.mode === "move"
        ? moveCrop(gesture.startCrop, deltaX, deltaY)
        : resizeCrop(gesture, deltaX, deltaY),
    );
  }

  function finishGesture(event: ReactPointerEvent<HTMLDivElement>): void {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const next = cropRef.current;
    if (next && imageSize) onCropChange(next, cropAspectRatio(next, imageSize));
  }

  function handleCropKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const current = cropRef.current;
    if (disabled || !current || !isArrowKey(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? KEYBOARD_CROP_STEP * 5 : KEYBOARD_CROP_STEP;
    const deltaX = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const deltaY = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    const next = moveCrop(current, deltaX, deltaY);
    updateDraftCrop(next);
    if (imageSize) onCropChange(next, cropAspectRatio(next, imageSize));
  }

  const previewWidth = imageSize && imageSize.width < imageSize.height
    ? `min(100%, ${Math.round(360 * imageSize.width / imageSize.height)}px)`
    : "100%";

  return (
    <section
      ref={rootRef}
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "canvas-image-editor-fields",
        name: "CanvasImageEditorFields",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      className="human2ai-canvas-image-editor-fields"
      aria-labelledby={contentLabelId}
    >
      <div className="human2ai-canvas-image-editor-fields__heading">
        <span id={contentLabelId} className="yisi-text-mark-editor-field-label">
          {labels.content}
        </span>
      </div>

      <div className="human2ai-canvas-image-editor-fields__actions">
        <input
          ref={inputRef}
          className="human2ai-canvas-image-editor-fields__input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <BasicButton
          mode="with-icon"
          icon={<UploadOutlined />}
          loading={uploading}
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? labels.uploading : src ? labels.replace : labels.upload}
        </BasicButton>
        {src && onReadFile && (
          <BasicButton
            mode="with-icon"
            icon={<DownloadOutlined aria-hidden="true" />}
            loading={downloading}
            disabled={uploading || downloading || imageFile?.src !== src}
            onClick={() => { void handleDownload(); }}
          >
            {downloading ? labels.downloading : labels.download}
          </BasicButton>
        )}
        <BasicButton
          mode="with-icon"
          icon={<CodeOutlined aria-hidden="true" />}
          disabled={disabled || uploading}
          aria-expanded={svgInputOpen}
          aria-controls={sourceId}
          onClick={() => {
            setSvgInput("");
            setSvgInputOpen(true);
            setUploadError(false);
          }}
        >
          {labels.svgPaste}
        </BasicButton>
        {svgSource !== null && (
          <ActionButton
            key={src}
            label={labels.svgCopy}
            pendingLabel={labels.svgCopying}
            successLabel={labels.svgCopied}
            errorLabel={labels.svgCopyFailed}
            idleIcon={<CopyOutlined aria-hidden="true" />}
            disabled={uploading}
            onAction={() => navigator.clipboard.writeText(svgSource)}
          />
        )}
      </div>

      <span className="human2ai-canvas-image-editor-fields__hint" role={uploadError ? "alert" : undefined}>
        {uploadError ? (svgInputOpen ? labels.svgSaveFailed : labels.uploadFailed) : labels.fileTypes}
      </span>

      {sourceLoading && <span role="status">{labels.sourceLoading}</span>}
      {downloadError === src && <span role="alert">{labels.downloadFailed}</span>}
      {sourceLoadFailed && (
        <div role="alert">
          {labels.sourceLoadFailed}
          <BasicButton onClick={() => setSourceAttempt((value) => value + 1)}>{labels.retry}</BasicButton>
        </div>
      )}
      {svgInputOpen && (
        <div id={sourceId} className="human2ai-canvas-image-editor-fields__source">
          <label htmlFor={`${sourceId}-input`}>{labels.svgSource}</label>
          <textarea
            id={`${sourceId}-input`}
            className="yisi-text-mark-editor-textarea"
            aria-label={labels.svgSource}
            value={svgInput}
            onChange={(event) => setSvgInput(event.target.value)}
            disabled={disabled || uploading}
            rows={10}
            spellCheck={false}
            autoFocus
          />
          <div className="human2ai-canvas-image-editor-fields__actions">
            <BasicButton
              loading={uploading}
              disabled={disabled || uploading || !svgInput.trim()}
              onClick={async () => {
                if (await handleFile(new File([svgInput], "image.svg", { type: "image/svg+xml" }))) {
                  setSvgInputOpen(false);
                }
              }}
            >
              {labels.svgApply}
            </BasicButton>
            <BasicButton disabled={uploading} onClick={() => { setSvgInputOpen(false); setUploadError(false); }}>
              {labels.cancel}
            </BasicButton>
          </div>
        </div>
      )}
      <div className="human2ai-canvas-image-editor-fields__preview-shell">
        {!src ? (
          <div
            className="human2ai-canvas-image-editor-fields__preview-status"
            aria-label={labels.content}
          >
            <UploadOutlined aria-hidden="true" />
          </div>
        ) : imageLoadFailed ? (
          <div className="human2ai-canvas-image-editor-fields__preview-status" role="alert">
            {labels.cropLoadFailed}
          </div>
        ) : (
          <div
            ref={previewRef}
            className="human2ai-canvas-image-editor-fields__preview"
            style={{
              aspectRatio: imageSize ? `${imageSize.width} / ${imageSize.height}` : undefined,
              visibility: imageSize ? "visible" : "hidden",
              width: previewWidth,
            }}
            onPointerDown={beginPreviewGesture}
            onPointerMove={moveGesture}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;
                setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
                setImageLoadFailed(false);
              }}
              onError={() => {
                setImageSize(null);
                setImageLoadFailed(true);
              }}
            />
            {draftCrop ? (
              <div
                className="human2ai-canvas-image-editor-fields__crop-selection"
                style={cropStyle(draftCrop)}
                role="group"
                aria-label={labels.cropTitle}
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                tabIndex={disabled ? -1 : 0}
                data-crop-selection
                onPointerDown={(event) => beginGesture(event, "move")}
                onKeyDown={handleCropKeyDown}
              >
                {CROP_HANDLES.map((handle) => (
                  <span
                    key={handle}
                    className="human2ai-canvas-image-editor-fields__crop-handle"
                    data-crop-handle={handle}
                    aria-hidden="true"
                    onPointerDown={(event) => beginGesture(event, "resize", handle)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

const CROP_HANDLES: CropHandle[] = [
  "north-west",
  "north-east",
  "south-east",
  "south-west",
];

function cropStyle(crop: Human2AiCanvasImageCrop) {
  return {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
    height: `${crop.height * 100}%`,
  };
}

function baseCrop(size: ImageSize, targetAspectRatio: number): Human2AiCanvasImageCrop {
  const sourceAspectRatio = size.width / size.height;
  if (sourceAspectRatio > targetAspectRatio) {
    return { x: 0, y: 0, width: targetAspectRatio / sourceAspectRatio, height: 1 };
  }
  return { x: 0, y: 0, width: 1, height: sourceAspectRatio / targetAspectRatio };
}

function centeredCrop(crop: Human2AiCanvasImageCrop): Human2AiCanvasImageCrop {
  return {
    ...crop,
    x: (1 - crop.width) / 2,
    y: (1 - crop.height) / 2,
  };
}

function moveCrop(
  crop: Human2AiCanvasImageCrop,
  deltaX: number,
  deltaY: number,
): Human2AiCanvasImageCrop {
  return {
    ...crop,
    x: clamp(crop.x + deltaX, 0, 1 - crop.width),
    y: clamp(crop.y + deltaY, 0, 1 - crop.height),
  };
}

function resizeCrop(
  gesture: CropGesture,
  deltaX: number,
  deltaY: number,
): Human2AiCanvasImageCrop {
  const crop = gesture.startCrop;
  const handle = gesture.handle ?? "south-east";
  const east = handle.endsWith("east");
  const south = handle.startsWith("south");
  const anchorX = east ? crop.x : crop.x + crop.width;
  const anchorY = south ? crop.y : crop.y + crop.height;
  const maximumWidth = east ? 1 - anchorX : anchorX;
  const maximumHeight = south ? 1 - anchorY : anchorY;
  const width = clamp(
    crop.width + (east ? deltaX : -deltaX),
    Math.min(MINIMUM_CROP_SIZE, maximumWidth),
    maximumWidth,
  );
  const height = clamp(
    crop.height + (south ? deltaY : -deltaY),
    Math.min(MINIMUM_CROP_SIZE, maximumHeight),
    maximumHeight,
  );
  return {
    x: east ? anchorX : anchorX - width,
    y: south ? anchorY : anchorY - height,
    width,
    height,
  };
}

function cropAspectRatio(
  crop: Human2AiCanvasImageCrop,
  imageSize: ImageSize,
): number {
  return (crop.width * imageSize.width) / (crop.height * imageSize.height);
}

function isArrowKey(key: string): boolean {
  return key === "ArrowLeft"
    || key === "ArrowRight"
    || key === "ArrowUp"
    || key === "ArrowDown";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
