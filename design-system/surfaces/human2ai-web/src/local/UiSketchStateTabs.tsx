"use client";

import { EllipsisOutlined } from "@ant-design/icons";
import { Dropdown, Input, Modal, Tooltip } from "antd";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

import { BasicButton } from "../vendor/yisiui/runtime/src/components/BasicButton";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";
import "./UiSketchStateTabs.css";

export interface UiSketchStateTabItem { id: string; label: string }
export interface UiSketchStateTabsLabels {
  switch: string;
  add: string;
  rename: string;
  name: string;
  new: string;
  delete: string;
  cancel: string;
  reorderHint: string;
  actions: (name: string) => string;
  deleteTitle: (name: string) => string;
}
export interface UiSketchStateTabsProps {
  items: readonly UiSketchStateTabItem[];
  value: string;
  labels: UiSketchStateTabsLabels;
  onChange: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCreate: (sourceId: string) => void;
  onReorder: (ids: string[]) => void;
}
interface DragState {
  id: string;
  x: number;
  y: number;
  target: string;
  after: boolean;
}

export function UiSketchStateTabs({
  items, value, labels, onChange, onRename, onDelete, onCreate, onReorder,
}: UiSketchStateTabsProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ id: string; kind: "rename" | "delete" } | null>(null);
  const [name, setName] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const returnFocusId = useRef<string | null>(null);
  const dialogItem = items.find((item) => item.id === dialog?.id);
  const itemsKey = items.map((item) => item.id).join("\0");

  function cancelDrag() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pointer.current = null;
    dragRef.current = null;
    setDrag(null);
  }
  useEffect(() => {
    const cancel = () => cancelDrag();
    window.addEventListener("blur", cancel);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  useEffect(() => { cancelDrag(); }, [itemsKey, value]);

  function begin(event: PointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0 || items.length < 2) return;
    cancelDrag();
    suppressClick.current = false;
    pointer.current = { id, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    timer.current = setTimeout(() => {
      if (!pointer.current) return;
      pointer.current.active = true;
      suppressClick.current = true;
      setMenuId(null);
      const next = { id, x: event.clientX, y: event.clientY, target: id, after: false };
      dragRef.current = next;
      setDrag(next);
    }, 350);
  }
  function move(event: PointerEvent<HTMLElement>) {
    const held = pointer.current;
    if (!held) return;
    if (!held.active) {
      if (Math.hypot(event.clientX - held.x, event.clientY - held.y) > 6) cancelDrag();
      return;
    }
    const rows = [...(root.current?.querySelectorAll<HTMLElement>("[data-state-id]") ?? [])];
    const target = rows.find((row) => event.clientX < row.getBoundingClientRect().right) ?? rows.at(-1);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const next = {
      id: held.id, x: event.clientX, y: event.clientY,
      target: target.dataset.stateId!, after: event.clientX > rect.x + rect.width / 2,
    };
    dragRef.current = next;
    setDrag(next);
    const scroller = root.current;
    if (scroller) {
      const bounds = scroller.getBoundingClientRect();
      if (event.clientX > bounds.right - 32) scroller.scrollLeft += 16;
      else if (event.clientX < bounds.left + 32) scroller.scrollLeft -= 16;
    }
  }
  function finish() {
    const current = dragRef.current;
    if (current && current.target !== current.id) {
      const ids = items.map((item) => item.id).filter((id) => id !== current.id);
      ids.splice(ids.indexOf(current.target) + (current.after ? 1 : 0), 0, current.id);
      onReorder(ids);
    }
    cancelDrag();
  }
  function focusItem(id: string, menu = false) {
    requestAnimationFrame(() => {
      const row = [...(root.current?.querySelectorAll<HTMLElement>("[data-state-id]") ?? [])]
        .find((element) => element.dataset.stateId === id);
      row?.querySelector<HTMLButtonElement>(menu ? ".human2ai-state-tabs__more" : "button[aria-pressed]")?.focus();
    });
  }

  return (
    <>
      <div
        {...uiAssetAttributes({ namespace: "human2ai", id: "ui-sketch-state-tabs", name: "UiSketchStateTabs", category: "module", origin: "project", status: "candidate" })}
        ref={root}
        className="human2ai-state-tabs"
        role="toolbar"
        aria-label={labels.switch}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancelDrag();
        }}
      >
        {items.map((item, index) => (
          <div
            className="human2ai-state-tabs__item"
            key={item.id}
            data-state-id={item.id}
            data-selected={value === item.id}
            data-dragging={drag?.id === item.id}
            data-drop={drag && drag.target === item.id && drag.id !== item.id ? (drag.after ? "after" : "before") : undefined}
          >
            <Tooltip title={labels.reorderHint} mouseEnterDelay={1}>
              <BasicButton
                type="text"
                aria-pressed={value === item.id}
                tabIndex={value === item.id ? 0 : -1}
                className="human2ai-state-tabs__tab"
                onPointerDown={(event) => begin(event, item.id)}
                onPointerMove={move}
                onPointerUp={finish}
                onPointerCancel={cancelDrag}
                onLostPointerCapture={cancelDrag}
                onClick={() => {
                  if (suppressClick.current) { suppressClick.current = false; return; }
                  onChange(item.id);
                }}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
                    : Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
                  if (event.ctrlKey && event.shiftKey) {
                    const ids = items.map((entry) => entry.id);
                    ids.splice(index, 1);
                    ids.splice(nextIndex, 0, item.id);
                    onReorder(ids);
                    focusItem(item.id);
                  } else {
                    onChange(items[nextIndex].id);
                    focusItem(items[nextIndex].id);
                  }
                }}
              >
                <span className="human2ai-state-tabs__label" title={item.label}>{item.label}</span>
              </BasicButton>
            </Tooltip>
            <Dropdown
              trigger={["click"]}
              open={menuId === item.id}
              onOpenChange={(open) => setMenuId(open ? item.id : null)}
              menu={{
                items: [
                  { key: "new", label: labels.new },
                  { key: "rename", label: labels.rename },
                  { key: "delete", label: labels.delete, danger: true, disabled: items.length === 1 },
                ],
                onClick: ({ key }) => {
                  setMenuId(null);
                  if (key === "new") onCreate(item.id);
                  else {
                    returnFocusId.current = item.id;
                    setName(item.label);
                    setDialog({ id: item.id, kind: key as "rename" | "delete" });
                  }
                },
              }}
            >
              <BasicButton
                type="text"
                mode="icon-only"
                icon={<EllipsisOutlined aria-hidden="true" />}
                className="human2ai-state-tabs__more"
                data-open={menuId === item.id}
                aria-label={labels.actions(item.label)}
                aria-haspopup="menu"
                aria-expanded={menuId === item.id}
              />
            </Dropdown>
          </div>
        ))}
        {items.length === 1 && (
          <BasicButton
            type="text"
            className="human2ai-state-tabs__add"
            onClick={() => onCreate(value)}
          >
            {labels.add}
          </BasicButton>
        )}
      </div>
      <Modal
        open={Boolean(dialogItem)}
        title={dialog?.kind === "rename" ? labels.rename : labels.deleteTitle(dialogItem?.label ?? "")}
        closable={false}
        okText={dialog?.kind === "rename" ? labels.rename : labels.delete}
        cancelText={labels.cancel}
        okButtonProps={{ danger: dialog?.kind === "delete", disabled: dialog?.kind === "rename" ? !name.trim() : items.length < 2 }}
        onCancel={() => setDialog(null)}
        afterClose={() => {
          const id = returnFocusId.current;
          if (id && items.some((item) => item.id === id)) focusItem(id, true);
          else focusItem(value);
        }}
        onOk={() => {
          if (!dialogItem || !dialog) return;
          if (dialog.kind === "rename") {
            if (!name.trim()) return;
            onRename(dialog.id, name.trim());
          } else if (items.length > 1) onDelete(dialog.id);
          setDialog(null);
        }}
        destroyOnHidden
        afterOpenChange={(open) => {
          if (open && dialog?.kind === "rename") document.querySelector<HTMLInputElement>(".human2ai-state-tabs__name")?.select();
        }}
      >
        {dialog?.kind === "rename" ? (
          <Input
            className="human2ai-state-tabs__name"
            aria-label={labels.name}
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={() => {
              if (dialogItem && name.trim()) { onRename(dialogItem.id, name.trim()); setDialog(null); }
            }}
          />
        ) : null}
      </Modal>
      {drag && createPortal(
        <div className="human2ai-state-tabs__ghost" aria-hidden="true" style={{ left: drag.x + 12, top: drag.y + 12 }}>
          {items.find((item) => item.id === drag.id)?.label}
        </div>, document.body,
      )}
    </>
  );
}
