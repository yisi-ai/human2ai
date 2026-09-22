"use client";

import { useEffect, useRef } from "react";

import styles from "../../styles/MessageComposer.module.css";

type Box = { left: number; top: number; right: number; bottom: number };
type Dot = { node: HTMLSpanElement; x: number; y: number; placed: boolean };

// Density follows the current background area, including the input's padding.
const PIXELS_PER_DOT = 1800;
const TEXT_PROPERTIES = [
  "font-family", "font-size", "font-weight", "font-style", "font-stretch",
  "font-variant", "font-feature-settings", "font-variation-settings", "font-kerning",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-indent",
  "text-transform", "text-rendering", "direction", "tab-size", "white-space",
  "word-break", "overflow-wrap", "hyphens",
] as const;

/** Private decoration: DOM measurements and animation never enter the message state. */
export function MessageComposerStars() {
  const layerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const dotContainer = dotsRef.current;
    const mirror = mirrorRef.current;
    const region = layer?.parentElement;
    const textarea = region?.querySelector<HTMLTextAreaElement>("[data-message-composer-input]");
    if (!layer || !dotContainer || !mirror || !region || !textarea) return;

    const dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let count = 0;
    let occupied: Box[] = [];
    let frame = 0;
    let disposed = false;

    const syncDotCount = () => {
      while (dots.length > count) dots.pop()!.node.remove();
      while (dots.length < count) {
        const node = document.createElement("span");
        node.className = styles.starDot;
        node.dataset.starDot = "";
        const size = 1.5 + Math.random() * 1.5;
        const duration = 1500 + Math.random() * 1300;
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        node.style.animationDuration = `${duration}ms`;
        node.style.animationDelay = `${-Math.random() * duration}ms`;
        dotContainer.appendChild(node);
        dots.push({ node, x: 0, y: 0, placed: false });
      }
    };

    // Only the center is excluded from text; dot edges and other dots may overlap.
    const available = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height
      && !occupied.some((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);

    const placeDot = (dot: Dot, index: number) => {
      dot.placed = false;
      dot.node.style.visibility = "hidden";
      if (index >= count) return;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        if (!available(x, y)) continue;
        dot.x = x;
        dot.y = y;
        dot.placed = true;
        dot.node.style.left = `${x}px`;
        dot.node.style.top = `${y}px`;
        dot.node.style.visibility = "visible";
        break;
      }
    };

    const refresh = () => {
      if (disposed) return;
      const regionRect = region.getBoundingClientRect();
      const inputRect = textarea.getBoundingClientRect();
      // Convert viewport measurements back to CSS pixels, including scaled previews.
      const scaleX = regionRect.width / region.offsetWidth || 1;
      const scaleY = regionRect.height / region.offsetHeight || 1;
      width = region.clientWidth;
      height = region.clientHeight;
      count = Math.round(width * height / PIXELS_PER_DOT);
      syncDotCount();
      occupied = [];

      const inputStyle = getComputedStyle(textarea);
      for (const property of TEXT_PROPERTIES) {
        mirror.style.setProperty(property, inputStyle.getPropertyValue(property));
      }
      const paddingLeft = parseFloat(inputStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(inputStyle.paddingRight) || 0;
      const paddingTop = parseFloat(inputStyle.paddingTop) || 0;
      mirror.style.width = `${Math.max(0, textarea.clientWidth - paddingLeft - paddingRight)}px`;
      mirror.textContent = textarea.value || textarea.placeholder;
      const mirrorRect = mirror.getBoundingClientRect();
      const textLeft = (inputRect.left - regionRect.left) / scaleX + textarea.clientLeft + paddingLeft - textarea.scrollLeft;
      const textTop = (inputRect.top - regionRect.top) / scaleY + textarea.clientTop + paddingTop - textarea.scrollTop;
      const clip: Box = {
        left: (inputRect.left - regionRect.left) / scaleX + textarea.clientLeft,
        top: (inputRect.top - regionRect.top) / scaleY + textarea.clientTop,
        right: (inputRect.left - regionRect.left) / scaleX + textarea.clientLeft + textarea.clientWidth,
        bottom: (inputRect.top - regionRect.top) / scaleY + textarea.clientTop + textarea.clientHeight,
      };
      const addBox = (box: Box, bounds: Box) => {
        const clipped = {
          left: Math.max(box.left, bounds.left), top: Math.max(box.top, bounds.top),
          right: Math.min(box.right, bounds.right), bottom: Math.min(box.bottom, bounds.bottom),
        };
        if (clipped.right > clipped.left && clipped.bottom > clipped.top) occupied.push(clipped);
      };
      const range = document.createRange();
      const textNode = mirror.firstChild;
      if (textNode) {
        // Keep empty lines and the space after each rendered line available.
        for (const match of mirror.textContent.matchAll(/[^\r\n]+/g)) {
          const trimmed = match[0].trim();
          if (!trimmed) continue;
          const start = match.index! + match[0].indexOf(trimmed);
          range.setStart(textNode, start);
          range.setEnd(textNode, start + trimmed.length);
          for (const rect of Array.from(range.getClientRects())) {
            if (!rect.width) continue;
            const lineHeight = parseFloat(inputStyle.lineHeight) || rect.height / scaleY;
            const top = textTop + (rect.top - mirrorRect.top) / scaleY;
            const linePadding = Math.max(0, (lineHeight - rect.height / scaleY) / 2);
            addBox({
              left: textLeft + (rect.left - mirrorRect.left) / scaleX,
              right: textLeft + (rect.right - mirrorRect.left) / scaleX,
              top: top - linePadding,
              bottom: top + rect.height / scaleY + linePadding,
            }, clip);
          }
        }
      }

      // The upper slot's unused padding is part of the background too.
      const topContent = region.querySelector<HTMLElement>("[data-message-composer-top-content]");
      if (topContent) {
        const topRect = topContent.getBoundingClientRect();
        const topBounds = {
          left: (topRect.left - regionRect.left) / scaleX,
          right: (topRect.right - regionRect.left) / scaleX,
          top: (topRect.top - regionRect.top) / scaleY,
          bottom: (topRect.bottom - regionRect.top) / scaleY,
        };
        range.selectNodeContents(topContent);
        for (const rect of Array.from(range.getClientRects())) {
          addBox({
            left: (rect.left - regionRect.left) / scaleX,
            right: (rect.right - regionRect.left) / scaleX,
            top: (rect.top - regionRect.top) / scaleY,
            bottom: (rect.bottom - regionRect.top) / scaleY,
          }, topBounds);
        }
      }
      // Keep decorative stars out of the visible scroll navigation area.
      const scrollbar = region.querySelector<HTMLElement>('[data-message-composer-scrollbar][data-visible="true"]');
      if (scrollbar) {
        const rect = scrollbar.getBoundingClientRect();
        occupied.push({
          left: (rect.left - regionRect.left) / scaleX,
          right: (rect.right - regionRect.left) / scaleX,
          top: (rect.top - regionRect.top) / scaleY,
          bottom: (rect.bottom - regionRect.top) / scaleY,
        });
      }
      dots.forEach((dot, index) => {
        if (index >= count || !dot.placed || !available(dot.x, dot.y)) placeDot(dot, index);
      });
      layer.style.opacity = "1";
    };

    const scheduleRefresh = () => {
      // Suppress old positions immediately while IME, wrapping or scroll settles.
      layer.style.opacity = "0";
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; refresh(); });
    };
    const moveDot = (event: AnimationEvent) => {
      const index = dots.findIndex((dot) => dot.node === event.target);
      if (index >= 0) placeDot(dots[index], index);
    };
    const resizeObserver = new ResizeObserver(scheduleRefresh);
    resizeObserver.observe(region);
    resizeObserver.observe(textarea);
    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => !layer.contains(record.target))) scheduleRefresh();
    });
    mutationObserver.observe(region, { childList: true, subtree: true, characterData: true, attributes: true });
    region.addEventListener("scroll", scheduleRefresh, true);
    textarea.addEventListener("input", scheduleRefresh);
    textarea.addEventListener("compositionupdate", scheduleRefresh);
    layer.addEventListener("animationiteration", moveDot);
    window.addEventListener("resize", scheduleRefresh);
    document.fonts.addEventListener("loadingdone", scheduleRefresh);
    void document.fonts.ready.then(() => { if (!disposed) scheduleRefresh(); });
    refreshRef.current = scheduleRefresh;
    refresh();

    return () => {
      disposed = true;
      refreshRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      dotContainer.replaceChildren();
      region.removeEventListener("scroll", scheduleRefresh, true);
      textarea.removeEventListener("input", scheduleRefresh);
      textarea.removeEventListener("compositionupdate", scheduleRefresh);
      layer.removeEventListener("animationiteration", moveDot);
      window.removeEventListener("resize", scheduleRefresh);
      document.fonts.removeEventListener("loadingdone", scheduleRefresh);
    };
  }, []);

  // Also synchronize programmatic value/slot updates from the controlled parent.
  useEffect(() => { refreshRef.current?.(); });

  return (
    <div ref={layerRef} className={styles.stars} aria-hidden="true" data-message-composer-stars>
      <div ref={mirrorRef} className={styles.starsMirror} />
      <div ref={dotsRef} />
    </div>
  );
}
