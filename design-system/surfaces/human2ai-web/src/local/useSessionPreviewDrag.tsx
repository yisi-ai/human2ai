import { useLayoutEffect, useRef, type DragEvent } from "react";
import { CloseCircleFilled } from "@ant-design/icons";
import { uiSessionPreviewSize } from "../../../../../src/domain/ui-sketch/session-preview";
import { draggedWorkspaceSession } from "./workspaceSessionDrag";

const ERROR_ICON_SIZE = 24;

interface DragPreview {
  sessionId: string;
  clientX: number;
  clientY: number;
  width: number;
  height: number;
  displayedSize?: { width: number; height: number };
  request: AbortController;
  objectUrl?: string;
  image?: HTMLImageElement;
  src?: string;
  failed?: boolean;
}

export function useSessionPreviewDrag(
  loadPreview: ((sessionId: string) => Promise<string>) | undefined,
  resetKey: string,
  enabled: boolean,
  canvasFrame: { width: number; height: number },
) {
  const previewRef = useRef<SVGGElement>(null);
  const errorRef = useRef<SVGGElement>(null);
  const imageRef = useRef<SVGImageElement>(null);
  const active = useRef<DragPreview | null>(null);
  const frame = useRef<number | null>(null);
  const canvasFrameRef = useRef(canvasFrame);

  function clear(): void {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    active.current?.request.abort();
    if (active.current?.image) {
      active.current.image.onload = null;
      active.current.image.onerror = null;
      active.current.image.src = "";
    }
    previewRef.current?.setAttribute("visibility", "hidden");
    errorRef.current?.setAttribute("visibility", "hidden");
    imageRef.current?.setAttribute("visibility", "hidden");
    imageRef.current?.removeAttribute("href");
    if (active.current?.objectUrl) URL.revokeObjectURL(active.current.objectUrl);
    active.current = null;
  }

  function schedule(): void {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const current = active.current, group = previewRef.current, scene = group?.ownerSVGElement;
      const transform = scene?.getScreenCTM();
      if (!current || !group || !scene || !transform) return;
      const point = scene.createSVGPoint();
      point.x = current.clientX; point.y = current.clientY;
      const center = point.matrixTransform(transform.inverse());
      const scaleX = Math.hypot(transform.a, transform.b), scaleY = Math.hypot(transform.c, transform.d);
      const size = uiSessionPreviewSize(current, canvasFrameRef.current);
      const { width, height } = size;
      if (current.src && !current.failed) current.displayedSize = size;
      group.setAttribute("transform", `translate(${center.x} ${center.y})`);
      group.setAttribute("visibility", current.failed || current.src ? "visible" : "hidden");
      errorRef.current?.setAttribute("visibility", current.failed ? "visible" : "hidden");
      errorRef.current?.setAttribute("transform", `scale(${1 / scaleX} ${1 / scaleY})`);
      imageRef.current?.setAttribute("visibility", !current.failed && current.src ? "visible" : "hidden");
      imageRef.current?.setAttribute("x", String(-width / 2));
      imageRef.current?.setAttribute("y", String(-height / 2));
      imageRef.current?.setAttribute("width", String(width));
      imageRef.current?.setAttribute("height", String(height));
      if (current.src && imageRef.current?.getAttribute("href") !== current.src) imageRef.current?.setAttribute("href", current.src);
    });
  }

  function canDrop(sessionId: string): boolean {
    return enabled && !(active.current?.sessionId === sessionId && active.current.failed);
  }

  function getSize(sessionId: string) {
    const current = active.current;
    return current?.sessionId === sessionId && !current.failed ? current.displayedSize : undefined;
  }

  function show(event: DragEvent<SVGSVGElement>): boolean {
    const sessionId = draggedWorkspaceSession(event.dataTransfer);
    if (!sessionId) return false;
    if (active.current?.sessionId !== sessionId) {
      clear();
      const current: DragPreview = { sessionId, clientX: event.clientX, clientY: event.clientY, width: 1, height: 1, failed: !enabled, request: new AbortController() };
      active.current = current;
      if (enabled && loadPreview) void loadPreview(sessionId).then(async src => {
        if (active.current !== current) return;
        const response = await fetch(src, { signal: current.request.signal });
        if (!response.ok) throw new Error("Preview image unavailable");
        const blob = await response.blob();
        if (active.current !== current) return;
        const objectUrl = URL.createObjectURL(blob);
        current.objectUrl = objectUrl;
        const image = new Image();
        current.image = image;
        image.onload = () => {
          if (active.current !== current) return;
          current.width = image.naturalWidth;
          current.height = image.naturalHeight;
          current.src = objectUrl;
          schedule();
        };
        image.onerror = () => { current.failed = true; if (active.current === current) schedule(); };
        image.src = objectUrl;
      }).catch(() => { current.failed = true; if (active.current === current) schedule(); });
    }
    active.current!.clientX = event.clientX;
    active.current!.clientY = event.clientY;
    schedule();
    return canDrop(sessionId);
  }

  useLayoutEffect(() => {
    canvasFrameRef.current = canvasFrame;
    if (active.current) schedule();
  }, [canvasFrame.width, canvasFrame.height]);

  useLayoutEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") clear(); };
    window.addEventListener("dragend", clear, true);
    window.addEventListener("drop", clear);
    window.addEventListener("blur", clear);
    window.addEventListener("keydown", escape);
    return () => {
      clear();
      window.removeEventListener("dragend", clear, true);
      window.removeEventListener("drop", clear);
      window.removeEventListener("blur", clear);
      window.removeEventListener("keydown", escape);
    };
  }, [loadPreview, resetKey, enabled]);

  return {
    show, clear, canDrop, getSize,
    preview: <g ref={previewRef} visibility="hidden" pointerEvents="none" aria-hidden="true" data-session-preview-drag>
      <image ref={imageRef} opacity={0.5} visibility="hidden" preserveAspectRatio="xMidYMid meet" />
      <g ref={errorRef} visibility="hidden" data-session-preview-drag-error>
        <foreignObject x={-ERROR_ICON_SIZE / 2} y={-ERROR_ICON_SIZE / 2} width={ERROR_ICON_SIZE} height={ERROR_ICON_SIZE}>
          <CloseCircleFilled style={{ display: "block", fontSize: ERROR_ICON_SIZE, color: "var(--yisiui-color-feedback-error)" }} />
        </foreignObject>
      </g>
    </g>,
  };
}
