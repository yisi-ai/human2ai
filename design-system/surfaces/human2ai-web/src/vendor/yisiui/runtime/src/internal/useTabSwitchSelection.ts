import { useLayoutEffect, useRef, type RefObject } from "react";

type Geometry = { key: string; x: number; y: number; width: number; height: number };

/** React owns the tabs; this hook owns only the shared background's geometry and readiness. */
export function useTabSwitchSelection(
  rootRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  nodes: RefObject<Map<string, HTMLDivElement>>,
  selectedKey: string,
) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const previous = useRef<Geometry | null>(null);
  const keyRef = useRef(selectedKey);
  const refresh = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    let frame: number | undefined;
    const observed = new Set<HTMLElement>();
    const measure = () => {
      const root = rootRef.current, indicator = indicatorRef.current;
      const node = nodes.current.get(keyRef.current);
      if (!root || !indicator) return;
      if (!node || !node.offsetWidth || !node.offsetHeight) {
        delete root.dataset.indicatorReady;
        previous.current = null;
        return;
      }
      // offset geometry is relative to the track, independent of scroll, RTL and drag transforms.
      const next = { key: keyRef.current, x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight };
      const old = previous.current;
      if (old && Object.keys(next).every((key) => next[key as keyof Geometry] === old[key as keyof Geometry])) return;
      if (old && old.key !== next.key && !root.hasAttribute("data-drag-state")) indicator.dataset.animate = "true";
      else delete indicator.dataset.animate;
      indicator.style.transform = `translate3d(${next.x}px, ${next.y}px, 0px)`;
      indicator.style.width = `${next.width}px`;
      indicator.style.height = `${next.height}px`;
      root.dataset.indicatorReady = "true";
      previous.current = next;
    };
    const schedule = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => { frame = undefined; measure(); });
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    const track = trackRef.current;
    if (track) observer?.observe(track);
    refresh.current = () => {
      const live = new Set(nodes.current.values());
      for (const node of observed) {
        if (!live.has(node as HTMLDivElement)) { observer?.unobserve(node); observed.delete(node); }
      }
      for (const node of live) {
        if (!observed.has(node)) { observer?.observe(node); observed.add(node); }
      }
      measure();
    };
    window.addEventListener("resize", schedule);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      refresh.current = null;
      previous.current = null;
      if (rootRef.current) delete rootRef.current.dataset.indicatorReady;
    };
  }, [rootRef, trackRef, nodes]);

  useLayoutEffect(() => { keyRef.current = selectedKey; refresh.current?.(); });
  return indicatorRef;
}
