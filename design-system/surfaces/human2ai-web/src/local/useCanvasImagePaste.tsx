import { message } from "antd";
import { useLayoutEffect, useRef } from "react";

import { getClipboardImage, readPastedImageSize } from "./clipboardImage";
import { transferCanvasClipboardImages } from "./canvasClipboard";
import type { CanvasImageEditorLabels } from "./CanvasImageEditorFields";

interface PastedCanvasImage {
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasImagePasteOptions {
  disabled: boolean;
  resetKey: string | number | undefined;
  labels: Pick<CanvasImageEditorLabels, "uploading" | "uploadFailed">;
  onUpload?: (file: File) => Promise<string>;
  onReadImageFile?: (src: string) => Promise<File>;
  resolveImageSource?: (assetId: string) => string | undefined;
  onImageReady: (image: PastedCanvasImage) => void;
  onCopy?: (event: ClipboardEvent) => void;
  onPasteFallback?: (event: ClipboardEvent) => void;
}

export function useCanvasImagePaste(options: CanvasImagePasteOptions) {
  const [messageApi, feedback] = message.useMessage();
  const sceneRef = useRef<SVGSVGElement>(null);
  const latest = useRef(options);
  const pending = useRef(false);
  const generation = useRef(0);

  useLayoutEffect(() => { latest.current = options; });
  useLayoutEffect(() => {
    pending.current = false;
    return () => {
      generation.current += 1;
      messageApi.destroy();
    };
  }, [messageApi, options.resetKey]);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const document = scene.ownerDocument;
    function handleClipboard(event: ClipboardEvent): void {
      if (event.defaultPrevented || options.disabled) return;
      // Native clipboard events can target body even when an SVG node has focus.
      const target = event.target === document.body ? document.activeElement : event.target;
      if (!(target instanceof Node) || !scene!.contains(target)) return;
      if (event.type === "copy") {
        options.onCopy?.(event);
      } else {
        const { x, y, width, height } = scene!.viewBox.baseVal;
        if (!onPaste(event, { x: x + width / 2, y: y + height / 2 })) {
          options.onPasteFallback?.(event);
        }
      }
    }
    document.addEventListener("copy", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    return () => {
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
    };
  });

  function onPaste(event: ClipboardEvent, center: { x: number; y: number }): boolean {
    if (event.defaultPrevented || options.disabled || !options.onUpload || !event.clipboardData) return false;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return false;
    const file = getClipboardImage(event.clipboardData);
    if (!file) return false;
    event.preventDefault();
    event.stopPropagation();
    const upload = options.onUpload;
    runImageTask(async isCurrent => {
      const size = await readPastedImageSize(file);
      if (!isCurrent()) return;
      const assetId = await upload(file);
      return () => latest.current.onImageReady({ assetId, ...center, ...size });
    });
    return true;
  }

  function runImageTask(task: (isCurrent: () => boolean) => Promise<(() => void) | undefined>): void {
    if (pending.current) return;
    pending.current = true;
    const requestGeneration = generation.current;
    const isCurrent = () => generation.current === requestGeneration && !latest.current.disabled;
    void messageApi.loading({ key: "canvas-image-paste", content: options.labels.uploading, duration: 0 });
    void (async () => {
      try {
        const commit = await task(isCurrent);
        if (isCurrent()) commit?.();
      } catch {
        if (generation.current === requestGeneration) {
          void messageApi.error(latest.current.labels.uploadFailed);
        }
      } finally {
        if (generation.current === requestGeneration) {
          pending.current = false;
          messageApi.destroy("canvas-image-paste");
        }
      }
    })();
  }

  function pasteNodes(images: { assetId: string | null }[], sources: Record<string, string>, commit: () => void): void {
    if (pending.current) return;
    const transfers = [...new Set(images.flatMap(image => image.assetId ? [image.assetId] : []))]
      .filter(id => !sources[id] || sources[id] !== options.resolveImageSource?.(id));
    if (transfers.length === 0) { commit(); return; }
    const { onReadImageFile: read, onUpload: upload, resolveImageSource: resolveSource } = options;
    runImageTask(async isCurrent => {
      if (await transferCanvasClipboardImages(images, sources, { origin: location.origin, read, upload, resolveSource, isCurrent })) return commit;
    });
  }

  return { sceneRef, feedback, pasteNodes };
}
