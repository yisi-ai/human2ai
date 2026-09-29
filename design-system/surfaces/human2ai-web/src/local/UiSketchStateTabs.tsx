"use client";

import { Input, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRef, useState } from "react";

import { TabSwitch, type TabSwitchItem, type TabSwitchItems } from "../vendor/yisiui/runtime/src/components/TabSwitch";
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
export function UiSketchStateTabs({
  items, value, labels, onChange, onCreate, onRename, onDelete, onReorder,
}: UiSketchStateTabsProps) {
  const [dialog, setDialog] = useState<{ id: string; kind: "rename" | "delete" } | null>(null);
  const [name, setName] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const returnFocusId = useRef<string | null>(null);
  const dialogItem = items.find((item) => item.id === dialog?.id);

  function focusItem(id: string, menu = false) {
    requestAnimationFrame(() => {
      const input = [...(root.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])]
        .find((element) => element.value === id);
      const target = menu ? input?.closest("[data-tab-key]")?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]') : input;
      target?.focus();
    });
  }

  return (
    <>
      <div
        {...uiAssetAttributes({ namespace: "human2ai", id: "ui-sketch-state-tabs", name: "UiSketchStateTabs", category: "module", origin: "project", status: "candidate" })}
        ref={root}
        className="human2ai-state-tabs"
      >
        <TabSwitch
          aria-label={labels.switch}
          compact
          // Canvas state operations always retain at least one state.
          items={items.map<TabSwitchItem>((item) => ({
            key: item.id,
            label: item.label,
            mode: "text-only",
            menu: {
              trigger: "hover",
              ariaLabel: labels.actions(item.label),
              items: [
                { key: "new", label: labels.new },
                { key: "rename", label: labels.rename },
                { key: "delete", label: labels.delete, danger: true, disabled: items.length === 1 },
              ],
              onAction: (key: string, id: string) => {
                if (key === "new") onCreate(id);
                else if (key === "rename" || key === "delete") {
                  returnFocusId.current = id;
                  setName(item.label);
                  setDialog({ id, kind: key });
                }
              },
            },
          })) as unknown as TabSwitchItems}
          value={value}
          onChange={onChange}
          trailingAction={items.length === 1 ? { label: labels.add, icon: <PlusOutlined aria-hidden="true" />, onClick: () => onCreate(value) } : undefined}
          reorderable
          onReorder={onReorder}
        />
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
    </>
  );
}
