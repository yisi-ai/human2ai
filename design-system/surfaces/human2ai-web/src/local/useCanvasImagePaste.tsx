import { message } from "antd";
import { useLayoutEffect, useRef } from "react";

import { getClipboardImage, readPastedImageSize } from "./clipboardImage";
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
    if (pending.current) return true;
    pending.current = true;
    const requestGeneration = generation.current;
    const upload = options.onUpload;
    void messageApi.loading({ key: "canvas-image-paste", content: options.labels.uploading, duration: 0 });
    void (async () => {
      try {
        const size = await readPastedImageSize(file);
        if (generation.current !== requestGeneration) return;
        const assetId = await upload(file);
        if (generation.current !== requestGeneration || latest.current.disabled) return;
        latest.current.onImageReady({ assetId, ...center, ...size });
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
    return true;
  }

  return { sceneRef, feedback };
}
