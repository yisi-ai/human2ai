import { Tooltip } from "antd";
import type { TooltipRef } from "antd/es/tooltip";
import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode, SVGProps } from "react";
import { createPortal } from "react-dom";

interface TooltipPoint {
  x: number;
  y: number;
}

// Keep pointer updates inside the overlay, without re-executing the node visual.
export function CanvasNodeTooltipOverlay({ children, title }: {
  children: ReactElement<SVGProps<SVGGElement>>;
  title: ReactNode;
}) {
  const id = useId();
  const tooltipRef = useRef<TooltipRef>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointRef = useRef<TooltipPoint | null>(null);
  const [point, setPoint] = useState<TooltipPoint | null>(null);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  useLayoutEffect(() => {
    // Moving a fixed anchor does not resize it, so realign explicitly.
    if (point) tooltipRef.current?.forceAlign();
  }, [point]);

  function show(x: number, y: number): void {
    pendingPointRef.current = {
      x: Math.max(8, Math.min(window.innerWidth - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - 8, y)),
    };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const next = pendingPointRef.current;
      setPoint((previous) => previous?.x === next?.x && previous?.y === next?.y ? previous : next);
    });
  }

  function hide(): void {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    pendingPointRef.current = null;
    setPoint(null);
  }

  return (
    <>
      {cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], point ? id : undefined].filter(Boolean).join(" ") || undefined,
        onMouseEnter(event) {
          children.props.onMouseEnter?.(event);
          if (!event.buttons) show(event.clientX + 12, event.clientY + 12);
        },
        onMouseMove(event) {
          children.props.onMouseMove?.(event);
          if (event.buttons) hide();
          else show(event.clientX + 12, event.clientY + 12);
        },
        onMouseLeave(event) {
          children.props.onMouseLeave?.(event);
          hide();
        },
        onFocus(event) {
          children.props.onFocus?.(event);
          const node = event.currentTarget.getBoundingClientRect();
          const viewport = event.currentTarget.closest(".human2ai-infinite-canvas-viewport")?.getBoundingClientRect();
          const left = Math.max(0, viewport?.left ?? 0, node.left);
          const top = Math.max(0, viewport?.top ?? 0, node.top);
          const right = Math.min(window.innerWidth, viewport?.right ?? window.innerWidth, node.right);
          const bottom = Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight, node.bottom);
          show((left + right) / 2, (top + bottom) / 2);
        },
        onBlur(event) {
          children.props.onBlur?.(event);
          hide();
        },
        onPointerDown(event) {
          children.props.onPointerDown?.(event);
          hide();
        },
        onKeyDown(event) {
          children.props.onKeyDown?.(event);
          if (event.key === "Escape") hide();
        },
      })}
      {point ? createPortal(
        <Tooltip
          ref={tooltipRef}
          id={id}
          title={title}
          open
          trigger={[]}
          arrow={false}
          placement="bottomLeft"
          align={{ offset: [0, 0], overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true } }}
          styles={{
            root: { position: "fixed", pointerEvents: "none", maxWidth: "min(250px, calc(100vw - 16px))" },
            container: { maxHeight: "calc(100vh - 16px)", overflow: "hidden" },
          }}
        >
          <span aria-hidden="true" style={{ position: "fixed", left: point.x, top: point.y, width: 1, height: 1, pointerEvents: "none" }} />
        </Tooltip>,
        document.body,
      ) : null}
    </>
  );
}
