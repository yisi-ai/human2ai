import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasLayerAction } from "../../../../../src/domain/canvas-layer-order.ts";

export type CanvasLayerLabels = Record<CanvasLayerAction, string>;
export const DEFAULT_CANVAS_LAYER_LABELS: CanvasLayerLabels = {
  bringToFront: "置于顶层",
  bringForward: "上移一层",
  sendBackward: "下移一层",
  sendToBack: "置于底层",
};

export function useCanvasContextMenu() {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPoint, setContextMenuPoint] = useState({ x: 0, y: 0 });
  const contextMenuTargetRef = useRef<HTMLElement | SVGElement | null>(null);
  const contextMenuPopupRef = useRef<HTMLDivElement>(null);
  const dismissContextMenu = useCallback(() => setContextMenuOpen(false), []);
  const closeContextMenu = useCallback(() => {
    setContextMenuOpen(false);
    contextMenuTargetRef.current?.focus();
  }, []);
  const openContextMenuAt = (point: { clientX: number; clientY: number }, target: HTMLElement | SVGElement | null) => {
    contextMenuTargetRef.current = target;
    setContextMenuPoint({ x: point.clientX, y: point.clientY });
    setContextMenuOpen(true);
  };

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && contextMenuPopupRef.current?.contains(event.target)) return;
      closeContextMenu();
    };
    // A new press dismisses the menu; the contextmenu following its opening release does not.
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [contextMenuOpen, closeContextMenu]);

  return { contextMenuOpen, contextMenuPoint, contextMenuPopupRef, openContextMenuAt, closeContextMenu, dismissContextMenu };
}
