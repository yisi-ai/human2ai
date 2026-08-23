"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";

interface ControlPosition {
  left: number;
  top: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  moved: boolean;
}

interface DraggableInspectorControls {
  controlsRef: RefObject<HTMLDivElement | null>;
  controlsStyle: CSSProperties | undefined;
  isDragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  shouldSuppressToggleClick: () => boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function useDraggableInspectorControls(
  mounted: boolean,
  expanded: boolean,
): DraggableInspectorControls {
  const [controlPosition, setControlPosition] = useState<ControlPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressToggleClickUntilRef = useRef(0);

  const clampControlsToViewport = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const rect = controls.getBoundingClientRect();
    setControlPosition((current) => {
      if (!current) return current;
      const next = {
        left: clamp(current.left, 8, window.innerWidth - rect.width - 8),
        top: clamp(current.top, 8, window.innerHeight - rect.height - 8),
      };
      return next.left === current.left && next.top === current.top ? current : next;
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const frame = window.requestAnimationFrame(clampControlsToViewport);
    window.addEventListener("resize", clampControlsToViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", clampControlsToViewport);
    };
  }, [clampControlsToViewport, expanded, mounted]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || !controlsRef.current) return;
    const rect = controlsRef.current.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    const dragState = dragStateRef.current;
    const controls = controlsRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !controls) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(deltaX, deltaY) < 4) return;
    dragState.moved = true;
    setIsDragging(true);
    const rect = controls.getBoundingClientRect();
    setControlPosition({
      left: clamp(dragState.startLeft + deltaX, 8, window.innerWidth - rect.width - 8),
      top: clamp(dragState.startTop + deltaY, 8, window.innerHeight - rect.height - 8),
    });
    event.preventDefault();
  }, []);

  const onPointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (dragState.moved) {
      suppressToggleClickUntilRef.current = window.performance.now() + 400;
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  const shouldSuppressToggleClick = useCallback(
    (): boolean => window.performance.now() < suppressToggleClickUntilRef.current,
    [],
  );

  return {
    controlsRef,
    controlsStyle: controlPosition ? {
      bottom: "auto",
      left: controlPosition.left,
      right: "auto",
      top: controlPosition.top,
    } : undefined,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    shouldSuppressToggleClick,
  };
}
