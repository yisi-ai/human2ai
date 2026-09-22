import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const nativeClass = "yisi-dot-scrollbar-native-hidden";
const nativeOwners = new WeakMap<HTMLElement, { count: number; original: boolean }>();

function hideNativeScrollbar(target: HTMLElement) {
  const owner = nativeOwners.get(target) ?? { count: 0, original: target.classList.contains(nativeClass) };
  owner.count += 1;
  nativeOwners.set(target, owner);
  target.classList.add(nativeClass);
  return () => {
    owner.count -= 1;
    if (owner.count === 0) {
      if (!owner.original) target.classList.remove(nativeClass);
      nativeOwners.delete(target);
    }
  };
}

interface DotLayout {
  positions: number[];
  activeIndex: number;
  pageCount: number;
  targetId?: string;
}

interface Connection {
  target: HTMLElement;
  rail: HTMLDivElement;
  maxDots: number;
  hideNative: boolean;
  refresh: () => void;
  dispose: () => void;
}

export function useDotScrollbar(
  targetRef: RefObject<HTMLElement | null>,
  railRef: RefObject<HTMLDivElement | null>,
  maxDots: number,
  hideNative: boolean,
) {
  const [layout, setLayout] = useState<DotLayout>({ positions: [], activeIndex: 0, pageCount: 0 });
  const connection = useRef<Connection | null>(null);

  // Inspect current on each commit so replacing a consumer's target DOM node rebinds it.
  useBrowserLayoutEffect(() => {
    const target = targetRef.current;
    const rail = railRef.current;
    const current = connection.current;
    if (current && current.target === target && current.rail === rail
      && current.maxDots === maxDots && current.hideNative === hideNative) {
      current.refresh();
      return;
    }
    current?.dispose();
    connection.current = null;
    if (!target || !rail) {
      setLayout((previous) => previous.positions.length || previous.pageCount
        ? { positions: [], activeIndex: 0, pageCount: 0 } : previous);
      return;
    }
    const view = target.ownerDocument.defaultView;
    if (!view) return;
    let frame = 0;
    let disposed = false;
    let releaseNative: (() => void) | undefined;
    let observedChildren = new Set<Element>();

    const measure = () => {
      frame = 0;
      if (disposed) return;
      const viewportHeight = target.clientHeight;
      const scrollHeight = target.scrollHeight;
      const maxScroll = Math.max(0, scrollHeight - viewportHeight);
      const railStyle = view.getComputedStyle(rail);
      const slotHeight = parseFloat(railStyle.getPropertyValue("--yisiui-dot-scrollbar-slot-height")) || 16;
      const railHeight = rail.clientHeight - (parseFloat(railStyle.paddingTop) || 0) - (parseFloat(railStyle.paddingBottom) || 0);
      const capacity = Math.max(0, Math.floor(railHeight / slotHeight));
      const pageCount = viewportHeight > 0 ? Math.ceil(scrollHeight / viewportHeight) : 0;
      const count = maxScroll > 1 && viewportHeight > 0 && capacity >= 2 ? Math.min(pageCount, maxDots, capacity) : 0;
      const positions = Array.from({ length: count }, (_, index) => count === pageCount
        ? Math.min(index * viewportHeight, maxScroll) : index * maxScroll / (count - 1));
      const scrollTop = Math.min(maxScroll, Math.max(0, target.scrollTop));
      let activeIndex = 0;
      positions.forEach((position, index) => {
        if (Math.abs(position - scrollTop) <= Math.abs(positions[activeIndex] - scrollTop)) activeIndex = index;
      });
      // Fractional scroll offsets can stop within a pixel of the bottom.
      if (count && maxScroll - scrollTop <= 0.5) activeIndex = count - 1;

      // A vertical accessory must not remove a necessary horizontal scrollbar.
      const shouldHide = hideNative && count >= 2 && target.scrollWidth <= target.clientWidth + 1;
      if (shouldHide && !releaseNative) releaseNative = hideNativeScrollbar(target);
      else if (!shouldHide && releaseNative) { releaseNative(); releaseNative = undefined; }
      else if (shouldHide && !target.classList.contains(nativeClass)) target.classList.add(nativeClass);

      const focused = target.ownerDocument.activeElement;
      if (focused instanceof HTMLElement && rail.contains(focused)
        && Number(focused.dataset.dotIndex) >= count) {
        if (count) rail.querySelector<HTMLButtonElement>(`[data-dot-index="${count - 1}"]`)?.focus({ preventScroll: true });
        else target.focus({ preventScroll: true });
      }
      const targetId = target.id || undefined;
      setLayout((previous) => previous.activeIndex === activeIndex && previous.pageCount === pageCount
        && previous.targetId === targetId && previous.positions.length === positions.length
        && positions.every((position, index) => position === previous.positions[index])
        ? previous : { positions, activeIndex, pageCount, targetId });
    };
    const refresh = () => { if (!disposed && !frame) frame = view.requestAnimationFrame(measure); };
    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(target);
    resizeObserver.observe(rail);
    const syncChildren = () => {
      const children = new Set(Array.from(target.children));
      observedChildren.forEach((child) => { if (!children.has(child)) resizeObserver.unobserve(child); });
      children.forEach((child) => { if (!observedChildren.has(child)) resizeObserver.observe(child); });
      observedChildren = children;
    };
    syncChildren();
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) syncChildren();
      refresh();
    });
    mutations.observe(target, { subtree: true, childList: true, characterData: true, attributes: true });

    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY) return;
      const maxScroll = target.scrollHeight - target.clientHeight;
      if (maxScroll <= 0 || event.deltaY < 0 && target.scrollTop <= 0 || event.deltaY > 0 && target.scrollTop >= maxScroll) return;
      const unit = event.deltaMode === 2 ? target.clientHeight : event.deltaMode === 1 ? 16 : 1;
      event.preventDefault();
      target.scrollTo({ top: target.scrollTop + event.deltaY * unit, behavior: "instant" });
    };
    target.addEventListener("scroll", refresh, { passive: true });
    target.addEventListener("load", refresh, true);
    target.addEventListener("input", refresh, true);
    rail.addEventListener("wheel", wheel, { passive: false });
    view.addEventListener("resize", refresh);
    target.ownerDocument.fonts?.addEventListener("loadingdone", refresh);
    void target.ownerDocument.fonts?.ready.then(refresh);
    connection.current = { target, rail, maxDots, hideNative, refresh, dispose: () => {
      disposed = true;
      if (frame) view.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutations.disconnect();
      target.removeEventListener("scroll", refresh);
      target.removeEventListener("load", refresh, true);
      target.removeEventListener("input", refresh, true);
      rail.removeEventListener("wheel", wheel);
      view.removeEventListener("resize", refresh);
      target.ownerDocument.fonts?.removeEventListener("loadingdone", refresh);
      releaseNative?.();
    } };
    measure();
  });

  useEffect(() => () => { connection.current?.dispose(); connection.current = null; }, []);
  return layout;
}
