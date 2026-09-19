"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasEditHistory, type CanvasHistorySnapshot } from "../../src/domain/session/canvas-edit-history";

function textEditor(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    'textarea, input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), [contenteditable="true"], [role="textbox"]',
  ));
}

function inEditor(target: EventTarget | null): boolean {
  return target === document.body || target instanceof Element && Boolean(target.closest("[data-canvas-editor], [data-human2ai-auto-save-node-editor]"));
}

export function useCanvasHistory<T, Context = undefined>(
  initial: T,
  restore: (snapshot: CanvasHistorySnapshot<T, Context>) => void,
  disabled = false,
) {
  const [history] = useState(() => new CanvasEditHistory<T, Context>(initial));
  const [, render] = useState(0);
  const [restoreToken, setRestoreToken] = useState(0);
  const latest = useRef({ restore, disabled });
  latest.current = { restore, disabled };
  const groups = useRef<{ pointer?: symbol; key?: symbol; text?: symbol }>({});
  const pointers = useRef(new Map<number, Element>());

  const actions = useMemo(() => {
    const refresh = () => render(value => value + 1);
    const cancelPointers = () => {
      for (const [pointerId, target] of [...pointers.current]) {
        target.dispatchEvent(new PointerEvent("pointercancel", { pointerId, bubbles: true }));
      }
      pointers.current.clear();
      groups.current = {};
    };
    const travel = (direction: "undo" | "redo") => {
      if (latest.current.disabled) return;
      cancelPointers();
      const snapshot = history[direction]();
      if (!snapshot) return;
      latest.current.restore(snapshot);
      setRestoreToken(value => value + 1);
      refresh();
    };
    return {
      current: () => history.current,
      record(next: T, beforeContext?: Context, afterContext = beforeContext) {
        const group = groups.current.pointer ?? groups.current.text ?? groups.current.key;
        const changed = history.record(next, beforeContext, afterContext, group);
        if (changed) refresh();
        return changed;
      },
      reset(next: T) {
        cancelPointers();
        history.reset(next);
        setRestoreToken(value => value + 1);
        refresh();
      },
      undo: () => travel("undo"),
      redo: () => travel("redo"),
    };
  }, [history]);

  useEffect(() => {
    const beginPointer = (event: PointerEvent) => {
      if (!inEditor(event.target) || !(event.target instanceof Element)) return;
      pointers.current.set(event.pointerId, event.target);
      if (!textEditor(event.target)) groups.current.pointer = Symbol("pointer");
    };
    const finishPointer = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      const pending = groups.current.pointer;
      // Capture runs before canvas/slider release handlers commit their final value.
      window.setTimeout(() => { if (groups.current.pointer === pending) groups.current.pointer = undefined; }, 0);
    };
    const focus = (event: FocusEvent) => {
      if (textEditor(event.target)) groups.current.text = Symbol("input");
    };
    const blur = () => { groups.current.text = undefined; };
    const windowBlur = () => { groups.current = {}; pointers.current.clear(); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.isComposing || textEditor(event.target) || !inEditor(event.target)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.altKey && (key === "z" || key === "y")) {
        if (latest.current.disabled) return;
        event.preventDefault();
        event.stopPropagation();
        if (key === "y" || event.shiftKey) actions.redo(); else actions.undo();
      } else if (!event.repeat) {
        groups.current.key = Symbol("key");
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      const pending = groups.current.key;
      if (!textEditor(event.target)) window.setTimeout(() => {
        if (groups.current.key === pending) groups.current.key = undefined;
      }, 0);
    };
    window.addEventListener("pointerdown", beginPointer, true);
    window.addEventListener("pointerup", finishPointer, true);
    window.addEventListener("pointercancel", finishPointer, true);
    window.addEventListener("focusin", focus, true);
    window.addEventListener("focusout", blur, true);
    window.addEventListener("keydown", keyDown, true);
    window.addEventListener("keyup", keyUp, true);
    window.addEventListener("blur", windowBlur);
    return () => {
      window.removeEventListener("pointerdown", beginPointer, true);
      window.removeEventListener("pointerup", finishPointer, true);
      window.removeEventListener("pointercancel", finishPointer, true);
      window.removeEventListener("focusin", focus, true);
      window.removeEventListener("focusout", blur, true);
      window.removeEventListener("keydown", keyDown, true);
      window.removeEventListener("keyup", keyUp, true);
      window.removeEventListener("blur", windowBlur);
    };
  }, [actions]);

  return { ...actions, restoreToken, canUndo: !disabled && history.canUndo, canRedo: !disabled && history.canRedo };
}
