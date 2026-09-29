import { useLayoutEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TabSwitchDragAnnouncements, TabSwitchItem } from "../components/TabSwitch";

type Position = { key: string; node: HTMLElement; left: number; width: number };
type Gesture = {
  pointerId: number; key: string; x: number; y: number; startX: number; startY: number;
  active: boolean; inside: boolean; scrollLeft: number; grabX: number;
  positions: Position[]; preview: string[]; rtl: boolean; target: HTMLElement;
};

/** React owns content/order; this hook exclusively owns temporary transforms and drag data attributes. */
export function useTabSwitchReorder(
  items: readonly TabSwitchItem[], enabled: boolean, onReorder: ((keys: string[]) => void) | undefined,
  announcements: Required<TabSwitchDragAnnouncements>,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const gesture = useRef<Gesture | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const latest = useRef({ items, onReorder, announcements });
  const detach = useRef(() => {});
  useLayoutEffect(() => {
    latest.current = { items, onReorder, announcements };
    if (gesture.current?.active) updateFeedback(gesture.current.inside);
  });
  // Identity-equivalent refreshes keep the gesture. Changes to order/content/availability cancel it.
  const signature = JSON.stringify(items.map(({ key, label, disabled, mode, ariaLabel, menu }) =>
    [key, label, !!disabled, mode, ariaLabel, menu?.trigger, menu?.items.map(({ key, label, disabled, danger }) => [key, label, !!disabled, !!danger])]));

  function clear() {
    clearTimeout(timer.current);
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
    frame.current = undefined;
    const current = gesture.current;
    gesture.current = null;
    detach.current();
    if (current?.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
    for (const node of nodes.current.values()) {
      node.style.removeProperty("transform");
      delete node.dataset.dragged;
    }
    if (rootRef.current) {
      delete rootRef.current.dataset.dragState;
      const feedback = rootRef.current.querySelector("[data-drag-feedback]");
      if (feedback) feedback.textContent = "";
    }
  }

  useLayoutEffect(() => { clear(); }, [signature, enabled]);
  useLayoutEffect(() => () => clear(), []);

  function updateFeedback(inside: boolean) {
    const feedback = rootRef.current?.querySelector("[data-drag-feedback]");
    const text = latest.current.announcements[inside ? "inside" : "outside"];
    if (feedback && feedback.textContent !== text) feedback.textContent = text;
  }

  function paint(autoScroll = false) {
    const current = gesture.current;
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!current?.active || !root || !viewport) return;
    const bounds = root.getBoundingClientRect();
    current.inside = current.x >= bounds.left && current.x <= bounds.right && current.y >= bounds.top && current.y <= bounds.bottom;
    const state = current.inside ? "dragging" : "cancel";
    if (root.dataset.dragState !== state) {
      root.dataset.dragState = state;
      updateFeedback(current.inside);
    }
    let scrolling = false;
    if (current.inside && autoScroll && viewport.scrollWidth > viewport.clientWidth) {
      const edge = Math.min(32, bounds.width / 4);
      const speed = current.x < bounds.left + edge ? -8 : current.x > bounds.right - edge ? 8 : 0;
      if (speed) {
        const previous = viewport.scrollLeft;
        viewport.scrollLeft += speed;
        scrolling = viewport.scrollLeft !== previous;
      }
    }
    const scrollDelta = viewport.scrollLeft - current.scrollLeft;
    const dragged = current.positions.find(({ key }) => key === current.key)!;
    const others = current.positions.filter(({ key }) => key !== current.key);
    // Measure insertion against fixed original centers, never against animated transforms.
    const center = current.x - current.grabX + dragged.width / 2 + scrollDelta;
    const index = others.filter(({ left, width }) => current.rtl ? center < left + width / 2 : center > left + width / 2).length;
    const preview = others.slice();
    preview.splice(index, 0, dragged);
    current.preview = (current.inside ? preview : current.positions).map(({ key }) => key);
    const firstEdge = Math.min(...current.positions.map(({ left }) => left));
    const lastEdge = Math.max(...current.positions.map(({ left, width }) => left + width));
    let cursor = current.rtl ? lastEdge : firstEdge;
    for (const key of current.preview) {
      const position = current.positions.find((entry) => entry.key === key)!;
      const left = current.rtl ? cursor - position.width : cursor;
      cursor += (current.rtl ? -1 : 1) * position.width;
      // Constrain the dragged box to the original strip so transforms cannot grow
      // scrollWidth and cause unbounded auto-scrolling at the end of the list.
      const draggedLeft = Math.max(firstEdge, Math.min(lastEdge - position.width, current.x - current.grabX + scrollDelta));
      const x = !current.inside ? 0 : key === current.key ? draggedLeft - position.left : left - position.left;
      const y = current.inside && key === current.key ? current.y - current.startY : 0;
      const transform = `translate3d(${Math.round(x * 1000) / 1000}px, ${Math.round(y * 1000) / 1000}px, 0px)`;
      if (position.node.style.transform !== transform) position.node.style.transform = transform;
    }
    if (scrolling) schedule();
  }

  function schedule() {
    if (frame.current !== undefined) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = undefined;
      paint(true);
    });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>, key: string) {
    if (!enabled || event.button !== 0 || event.isPrimary === false || gesture.current || items.length < 2) return;
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;
    const target = event.currentTarget;
    let resizeObserver: ResizeObserver | undefined;
    const current: Gesture = {
      pointerId: event.pointerId, key, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
      active: false, inside: true, positions: [], preview: [], scrollLeft: viewport.scrollLeft, grabX: 0,
      rtl: getComputedStyle(root).direction === "rtl", target,
    };
    gesture.current = current;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== current.pointerId) return;
      current.x = e.clientX; current.y = e.clientY;
      if (!current.active) {
        if (Math.hypot(current.x - current.startX, current.y - current.startY) > 6) clear();
        return;
      }
      e.preventDefault();
      schedule();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== current.pointerId) return;
      current.x = e.clientX; current.y = e.clientY;
      if (current.active) paint(); // Include the release position even before the next animation frame.
      const order = current.active && current.inside ? current.preview : null;
      const changed = order && order.some((entry, index) => entry !== latest.current.items[index]?.key);
      clear();
      if (changed) latest.current.onReorder?.(order);
    };
    const cancelPointer = (e: PointerEvent) => { if (e.pointerId === current.pointerId) clear(); };
    const cancel = () => clear();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); clear(); }
      else if (current.active) { e.preventDefault(); }
    };
    // Prevent the browser from taking over a held touch gesture; a swipe before
    // activation still scrolls normally and cancels the pending hold.
    const touchmove = (e: TouchEvent) => { if (current.active) e.preventDefault(); };
    window.addEventListener("touchmove", touchmove, { passive: false });
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancelPointer);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    window.addEventListener("keydown", keydown, true);
    target.addEventListener("lostpointercapture", cancel);
    detach.current = () => {
      resizeObserver?.disconnect();
      window.removeEventListener("touchmove", touchmove);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancelPointer);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("keydown", keydown, true);
      target.removeEventListener("lostpointercapture", cancel);
    };
    timer.current = setTimeout(() => {
      if (gesture.current !== current) return;
      current.positions = latest.current.items.flatMap(({ key }) => {
        const node = nodes.current.get(key);
        if (!node) return [];
        const rect = node.getBoundingClientRect();
        return [{ key, node, left: rect.left, width: rect.width }];
      });
      const dragged = current.positions.find((entry) => entry.key === key);
      if (!dragged || !dragged.width) { clear(); return; }
      const bounds = root.getBoundingClientRect();
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          const nextBounds = root.getBoundingClientRect();
          if (Math.abs(nextBounds.width - bounds.width) > 0.5 || Math.abs(nextBounds.height - bounds.height) > 0.5 ||
            current.positions.some(({ node, width }) => Math.abs(node.getBoundingClientRect().width - width) > 0.5)) clear();
        });
        resizeObserver.observe(root);
        current.positions.forEach(({ node }) => resizeObserver!.observe(node));
      }
      current.active = true;
      current.scrollLeft = viewport.scrollLeft;
      current.grabX = current.startX - dragged.left;
      suppressClick.current = true;
      dragged.node.dataset.dragged = "true";
      // Capture only after the hold, preserving native click/focus and touch scrolling before it.
      try { target.setPointerCapture?.(current.pointerId); } catch { /* Pointer already ended. */ }
      paint();
    }, 350);
  }

  const resetClickSuppression = () => { if (!gesture.current?.active) suppressClick.current = false; };
  return { rootRef, viewportRef, nodes, onPointerDown, suppressClick, resetClickSuppression };
}
