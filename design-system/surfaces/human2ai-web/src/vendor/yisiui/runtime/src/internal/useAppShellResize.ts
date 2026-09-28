import { useLayoutEffect, useRef } from "react";
import type { AppShellFrameProps } from "../layouts/AppShellFrame";

type ResizeOptions = Required<Pick<AppShellFrameProps,
  "sidebarWidth" | "sidebarResizable" | "sidebarMinWidth" | "sidebarMaxWidth" |
  "rightPanelWidth" | "rightPanelResizable" | "rightPanelMinWidth" | "rightPanelMaxWidth" | "contentMinWidth"
>> & Pick<AppShellFrameProps, "onSidebarWidthChange" | "onRightPanelWidthChange"> & {
  isSidebarVisible: boolean;
  isRightPanelVisible: boolean;
};
type Side = 0 | 1;
const widthProperties = ["--yisiui-app-shell-sidebar-resized-width", "--yisiui-app-shell-right-panel-resized-width"];
const finiteWidth = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, value) : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Owns geometry outside React so pointer movement never renders the shell's slots. */
export function useAppShellResize(options: ResizeOptions) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const rightPanelRef = useRef<HTMLElement>(null);
  const sidebarHandleRef = useRef<HTMLDivElement>(null);
  const rightPanelHandleRef = useRef<HTMLDivElement>(null);
  const preferred = useRef<[number | undefined, number | undefined]>([undefined, undefined]);
  const previousInputs = useRef([options.sidebarWidth, options.rightPanelWidth]);
  const callbacks = useRef(options);
  useLayoutEffect(() => { callbacks.current = options; });

  const { sidebarWidth, sidebarResizable, sidebarMinWidth, sidebarMaxWidth,
    rightPanelWidth, rightPanelResizable, rightPanelMinWidth, rightPanelMaxWidth,
    contentMinWidth, isSidebarVisible, isRightPanelVisible } = options;

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const doc = root.ownerDocument;
    const win = doc.defaultView!;
    const panels = [sidebarRef.current, rightPanelRef.current];
    const handles = [sidebarHandleRef.current, rightPanelHandleRef.current];
    const visible = [isSidebarVisible, isRightPanelVisible];
    const resizable = [sidebarResizable, rightPanelResizable];
    const inputs = [sidebarWidth, rightPanelWidth];
    const mins = [finiteWidth(sidebarMinWidth, 180), finiteWidth(rightPanelMinWidth, 240)];
    const maxes = [Math.max(mins[0], finiteWidth(sidebarMaxWidth, 480)), Math.max(mins[1], finiteWidth(rightPanelMaxWidth, 560))];
    const centerMin = finiteWidth(contentMinWidth, 320);
    let widths = [0, 0];
    let available = 0;
    let session: { side: Side; pointerId: number; handle: HTMLDivElement; startX: number; startWidth: number;
      previous: number | undefined; scale: number; shield: HTMLDivElement } | null = null;

    root.style.setProperty("--yisiui-app-shell-content-min-width", `${centerMin}px`);
    for (const side of [0, 1] as const) {
      if (inputs[side] !== previousInputs.current[side]) preferred.current[side] = undefined;
      previousInputs.current[side] = inputs[side];
    }

    function upperBound(side: Side) {
      return Math.max(mins[side], Math.min(maxes[side], available - centerMin - widths[1 - side]));
    }

    function writeWidths() {
      for (const side of [0, 1] as const) {
        if (visible[side] && resizable[side]) root.style.setProperty(widthProperties[side], `${widths[side]}px`);
        else root.style.removeProperty(widthProperties[side]);
        const handle = handles[side];
        if (!handle) continue;
        handle.setAttribute("aria-valuemin", String(Math.round(mins[side])));
        handle.setAttribute("aria-valuemax", String(Math.round(upperBound(side))));
        handle.setAttribute("aria-valuenow", String(Math.round(widths[side])));
        handle.setAttribute("aria-valuetext", `${Math.round(widths[side])}px`);
        handle.setAttribute("aria-disabled", String(upperBound(side) <= mins[side]));
      }
    }

    function synchronize() {
      // Resolve CSS lengths (including %, rem and tokens) through the existing grid.
      for (const side of [0, 1] as const) root.style.removeProperty(widthProperties[side]);
      available = root.clientWidth;
      const computed = win.getComputedStyle(root);
      available -= (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
      if (available <= 0) return;
      widths = panels.map((panel, side) => {
        if (!visible[side] || !panel) return 0;
        const width = panel.getBoundingClientRect().width / (root.getBoundingClientRect().width / root.offsetWidth || 1);
        return resizable[side] ? clamp(preferred.current[side] ?? width, mins[side], maxes[side]) : width;
      });
      // Shrink both flexible sides proportionally when the container gets smaller.
      const capacity = widths.map((width, side) => visible[side] && resizable[side] ? width - mins[side] : 0);
      const totalCapacity = capacity[0] + capacity[1];
      const excess = Math.min(totalCapacity, Math.max(0, widths[0] + widths[1] + centerMin - available));
      if (totalCapacity > 0) widths = widths.map((width, side) => width - excess * capacity[side] / totalCapacity);
      writeWidths();
    }

    function notify(side: Side) {
      const callback = side === 0 ? callbacks.current.onSidebarWidthChange : callbacks.current.onRightPanelWidthChange;
      callback?.(widths[side]);
    }

    function finish(commit: boolean) {
      const active = session;
      if (!active) return;
      session = null;
      active.shield.remove();
      root.removeAttribute("data-resizing");
      active.handle.removeAttribute("data-active");
      if (active.handle.hasPointerCapture?.(active.pointerId)) active.handle.releasePointerCapture(active.pointerId);
      if (!commit) {
        preferred.current[active.side] = active.previous;
        synchronize();
      } else if (widths[active.side] !== active.startWidth) notify(active.side);
    }

    function move(event: PointerEvent) {
      const active = session;
      if (!active || event.pointerId !== active.pointerId) return;
      event.preventDefault();
      const direction = active.side === 0 ? 1 : -1;
      const next = clamp(active.startWidth + direction * (event.clientX - active.startX) / active.scale,
        mins[active.side], upperBound(active.side));
      if (next === widths[active.side]) return;
      preferred.current[active.side] = next;
      widths[active.side] = next;
      writeWidths();
    }

    const cleanups: Array<() => void> = [];
    for (const side of [0, 1] as const) {
      const handle = handles[side];
      if (!handle) continue;
      const down = (event: PointerEvent) => {
        if (session || event.button !== 0 || !event.isPrimary || upperBound(side) <= mins[side]) return;
        event.preventDefault();
        // Pointer resizing must not leave a keyboard focus indicator behind.
        // Escape is handled on the document, so the drag does not need focus.
        if (doc.activeElement === handle) handle.blur();
        handle.setPointerCapture(event.pointerId);
        const shield = doc.createElement("div");
        shield.className = "yisi-app-shell-resize-shield";
        shield.setAttribute("aria-hidden", "true");
        doc.body.append(shield);
        session = { side, pointerId: event.pointerId, handle, startX: event.clientX, startWidth: widths[side],
          previous: preferred.current[side], scale: root.getBoundingClientRect().width / root.offsetWidth || 1, shield };
        root.setAttribute("data-resizing", side === 0 ? "sidebar" : "right-panel");
        handle.setAttribute("data-active", "true");
      };
      const keydown = (event: KeyboardEvent) => {
        if (session) return;
        const step = (event.shiftKey ? 32 : 8) * (side === 0 ? 1 : -1);
        const target = event.key === "ArrowLeft" ? widths[side] - step
          : event.key === "ArrowRight" ? widths[side] + step
          : event.key === "Home" ? mins[side] : event.key === "End" ? upperBound(side) : null;
        if (target === null) return;
        event.preventDefault();
        event.stopPropagation();
        const next = clamp(target, mins[side], upperBound(side));
        if (next === widths[side]) return;
        preferred.current[side] = next;
        widths[side] = next;
        writeWidths();
        notify(side);
      };
      const lost = (event: PointerEvent) => { if (session?.pointerId === event.pointerId) finish(false); };
      handle.addEventListener("pointerdown", down);
      handle.addEventListener("keydown", keydown);
      handle.addEventListener("lostpointercapture", lost);
      cleanups.push(() => {
        handle.removeEventListener("pointerdown", down);
        handle.removeEventListener("keydown", keydown);
        handle.removeEventListener("lostpointercapture", lost);
      });
    }

    const up = (event: PointerEvent) => {
      if (session?.pointerId !== event.pointerId) return;
      move(event);
      finish(true);
    };
    const cancelPointer = (event: PointerEvent) => { if (session?.pointerId === event.pointerId) finish(false); };
    const cancel = () => finish(false);
    const escape = (event: KeyboardEvent) => {
      if (session && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
    };
    const resize = () => { cancel(); synchronize(); };
    doc.addEventListener("pointermove", move, { passive: false });
    doc.addEventListener("pointerup", up);
    doc.addEventListener("pointercancel", cancelPointer);
    doc.addEventListener("keydown", escape);
    win.addEventListener("blur", cancel);
    win.addEventListener("resize", resize);
    synchronize();
    let lastWidth = root.clientWidth;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (root.clientWidth === lastWidth) return;
      lastWidth = root.clientWidth;
      resize();
    });
    observer?.observe(root);
    return () => {
      cancel();
      observer?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerup", up);
      doc.removeEventListener("pointercancel", cancelPointer);
      doc.removeEventListener("keydown", escape);
      win.removeEventListener("blur", cancel);
      win.removeEventListener("resize", resize);
    };
  }, [sidebarWidth, sidebarResizable, sidebarMinWidth, sidebarMaxWidth, rightPanelWidth, rightPanelResizable,
    rightPanelMinWidth, rightPanelMaxWidth, contentMinWidth, isSidebarVisible, isRightPanelVisible]);

  return { rootRef, sidebarRef, rightPanelRef, sidebarHandleRef, rightPanelHandleRef };
}
