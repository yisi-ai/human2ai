import { useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";

type Direction = -1 | 1;
type Edges = { overflow: boolean; left: boolean; right: boolean; rtl: boolean };

/** Arrow scrolling only changes scrollLeft; React updates when overflow/edge availability changes. */
export function useTabSwitchScroll(rootRef: RefObject<HTMLDivElement | null>, viewportRef: RefObject<HTMLDivElement | null>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edges>({ overflow: false, left: false, right: false, rtl: false });
  const frame = useRef<number | undefined>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hover = useRef<Direction | null>(null);
  const press = useRef<{ id: number; direction: Direction; held: boolean } | null>(null);
  const suppressClick = useRef(false);
  const lastTime = useRef<number | undefined>(undefined);

  function range() {
    const viewport = viewportRef.current;
    if (!viewport) return { min: 0, max: 0 };
    const extent = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    return getComputedStyle(viewport).direction === "rtl" ? { min: -extent, max: 0 } : { min: 0, max: extent };
  }

  function measure() {
    const root = rootRef.current, viewport = viewportRef.current, track = trackRef.current;
    if (!root || !viewport || !track) return;
    const css = getComputedStyle(root);
    const available = Math.max(0, root.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0));
    // max-content track width is the real flex layout. scrollWidth also includes
    // transient painted overflow (e.g. the previous selection position after deletion).
    // Including that overflow lets arrows change the threshold that creates them.
    const overflow = track.clientWidth > available + 1;
    const { min, max } = range();
    const next = { overflow, left: overflow && viewport.scrollLeft > min + 1, right: overflow && viewport.scrollLeft < max - 1, rtl: getComputedStyle(viewport).direction === "rtl" };
    setEdges((previous) => previous.overflow === next.overflow && previous.left === next.left && previous.right === next.right && previous.rtl === next.rtl ? previous : next);
    if (!overflow) {
      stop();
      if (document.activeElement instanceof HTMLElement && document.activeElement.matches(".yisi-tab-switch-scroll-arrow") && root.contains(document.activeElement)) {
        (root.querySelector<HTMLElement>('input:checked:not(:disabled)') ?? root.querySelector<HTMLElement>('input:not(:disabled), .yisi-tab-switch-trailing-action button:not(:disabled)'))?.focus({ preventScroll: true });
      }
    }
  }

  function moveBy(distance: number) {
    const viewport = viewportRef.current;
    if (!viewport) return false;
    const { min, max } = range();
    const previous = viewport.scrollLeft;
    viewport.scrollLeft = Math.max(min, Math.min(max, previous + distance));
    measure();
    return Math.abs(viewport.scrollLeft - previous) > 0.01;
  }

  function stopFrame() {
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
    frame.current = undefined;
    lastTime.current = undefined;
  }

  function stop() {
    stopFrame();
    clearTimeout(holdTimer.current);
    hover.current = null;
    if (press.current) suppressClick.current = true;
    press.current = null;
  }

  function run() {
    if (frame.current !== undefined) return;
    const tick = (time: number) => {
      frame.current = undefined;
      // During a short press, wait for click or the long-press threshold.
      const direction = press.current ? (press.current.held ? press.current.direction : null) : hover.current;
      if (direction === null || rootRef.current?.dataset.dragState) { stopFrame(); return; }
      const elapsed = Math.min(32, lastTime.current === undefined ? 16 : time - lastTime.current);
      lastTime.current = time;
      if (moveBy(direction * elapsed * (press.current ? 0.32 : 0.18))) frame.current = window.requestAnimationFrame(tick);
      else stopFrame();
    };
    frame.current = window.requestAnimationFrame(tick);
  }

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current, viewport = viewportRef.current, track = trackRef.current;
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    if (root) observer?.observe(root);
    if (viewport) observer?.observe(viewport);
    if (track) observer?.observe(track);
    const up = (event: PointerEvent) => {
      if (press.current?.id !== event.pointerId) return;
      suppressClick.current = press.current.held;
      press.current = null;
      clearTimeout(holdTimer.current);
      stopFrame();
      if (hover.current !== null) run();
    };
    const cancel = () => stop();
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") stop(); };
    const visibility = () => { if (document.hidden) stop(); };
    viewport?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", keydown);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stop();
      observer?.disconnect();
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  // Content updates can change overflow even when the viewport's size is unchanged.
  useLayoutEffect(() => { measure(); });

  function buttonProps(direction: Direction) {
    return {
      disabled: direction < 0 ? !edges.left : !edges.right,
      onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.pointerType === "touch" || event.buttons > 0) return;
        hover.current = direction;
        run();
      },
      onPointerLeave: stop,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        stopFrame();
        clearTimeout(holdTimer.current);
        suppressClick.current = false;
        press.current = { id: event.pointerId, direction, held: false };
        holdTimer.current = setTimeout(() => {
          if (!press.current) return;
          press.current.held = true;
          run();
        }, 350);
      },
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
      onClick: () => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        moveBy(direction * Math.max(96, (viewportRef.current?.clientWidth ?? 0) * 0.8));
      },
      onKeyDown: () => { suppressClick.current = false; },
    };
  }

  return { trackRef, edges, buttonProps };
}
