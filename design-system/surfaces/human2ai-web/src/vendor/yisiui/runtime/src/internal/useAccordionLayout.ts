import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface AccordionLayoutOptions {
  listRef: RefObject<HTMLUListElement | null>;
  measurementRef: RefObject<HTMLDivElement | null>;
  contentNodes: RefObject<Map<string, HTMLDivElement>>;
  items: readonly { key: string }[];
  expandedKey: string | null;
  minTitleFontSize: number;
  maxTitleFontSize: number;
  showIcon: boolean;
}

/** Measure each real content once, and fit only inert text mirrors at different sizes. */
export function useAccordionLayout({
  listRef, measurementRef, contentNodes, items, expandedKey,
  minTitleFontSize, maxTitleFontSize, showIcon,
}: AccordionLayoutOptions) {
  const [layout, setLayout] = useState<{ height: number; titleFontSize: number } | null>(null);
  const expandedRef = useRef(expandedKey);
  const refreshRef = useRef<(() => void) | null>(null);

  useBrowserLayoutEffect(() => {
    expandedRef.current = expandedKey;
  }, [expandedKey]);

  useBrowserLayoutEffect(() => {
    const list = listRef.current;
    const measurement = measurementRef.current;
    if (!list || !measurement) return;
    let frame = 0;
    let disposed = false;
    let observedWidth = -1;
    const headerMirrors = Array.from(measurement.children) as HTMLElement[];

    const measure = () => {
      if (disposed || !list.clientWidth) return;
      const listRect = list.getBoundingClientRect();
      const cssHeight = parseFloat(getComputedStyle(list).height);
      const scaleY = cssHeight > 0 ? listRect.height / cssHeight : 1;
      const heightOf = (node: HTMLElement) => Math.ceil(node.getBoundingClientRect().height / (scaleY || 1));
      const headerTotal = (fontSize: number) => {
        measurement.style.setProperty("--yisiui-accordion-title-size", `${fontSize}px`);
        return headerMirrors.reduce((sum, node) => sum + heightOf(node), 0);
      };
      const heights = items.map(({ key }) => {
        const content = contentNodes.current.get(key);
        return content ? heightOf(content) : 0;
      });
      const separators = Array.from(list.children).reduce((sum, node) => {
        const rowStyle = getComputedStyle(node);
        return sum + (parseFloat(rowStyle.borderTopWidth) || 0) + (parseFloat(rowStyle.borderBottomWidth) || 0);
      }, 0);

      // This budget is independent of which item is open and of the fitted font.
      const height = Math.ceil(headerTotal(minTitleFontSize) + Math.max(0, ...heights) + separators);
      const selectedIndex = items.findIndex(({ key }) => key === expandedRef.current);
      const available = height - (heights[selectedIndex] ?? 0) - separators;
      let lower = 0;
      let upper = Math.floor((maxTitleFontSize - minTitleFontSize) * 4);
      while (lower < upper) {
        const step = Math.ceil((lower + upper) / 2);
        if (headerTotal(minTitleFontSize + step / 4) <= available) lower = step;
        else upper = step - 1;
      }
      const titleFontSize = minTitleFontSize + lower / 4;
      measurement.style.setProperty("--yisiui-accordion-title-size", `${titleFontSize}px`);
      setLayout((previous) => previous?.height === height && previous.titleFontSize === titleFontSize
        ? previous : { height, titleFontSize });
    };

    const schedule = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const resizeObserver = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        if (entry.target === list) {
          // Changing title size or opening an item must not trigger a measurement loop.
          if (Math.abs(entry.contentRect.width - observedWidth) > 0.1) {
            observedWidth = entry.contentRect.width;
            changed = true;
          }
        } else changed = true;
      }
      if (changed) schedule();
    });
    resizeObserver.observe(list);
    for (const node of contentNodes.current.values()) resizeObserver.observe(node);
    for (const title of list.querySelectorAll(":scope > li > .yisi-adaptive-accordion-trigger > .yisi-adaptive-accordion-title")) {
      resizeObserver.observe(title);
    }
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(() => { if (!disposed) schedule(); });
    refreshRef.current = measure;
    measure();
    return () => {
      disposed = true;
      refreshRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [listRef, measurementRef, contentNodes, items, minTitleFontSize, maxTitleFontSize, showIcon]);

  useBrowserLayoutEffect(() => { refreshRef.current?.(); }, [expandedKey]);
  return layout;
}
