"use client";

import { DownOutlined } from "@ant-design/icons";
import { Select } from "antd";
import type { SelectProps } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./CompactDropdownSelect.css";

export type CompactDropdownSelectPlacement = "top" | "bottom";

export interface CompactDropdownSelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface CompactDropdownSelectProps {
  value?: string;
  options: readonly CompactDropdownSelectOption[];
  onChange: (value: string) => void;
  "aria-label": string;
  placeholder?: ReactNode;
  placement?: CompactDropdownSelectPlacement;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

const CLOSE_DELAY_MS = 120;
const LIST_HEIGHT = 240;

const connectedPlacements = {
  bottomLeft: {
    points: ["tl", "bl"],
    offset: [0, -1],
    overflow: { adjustX: 0, adjustY: 1 },
    htmlRegion: "scroll",
  },
  topLeft: {
    points: ["bl", "tl"],
    offset: [0, 1],
    overflow: { adjustX: 0, adjustY: 1 },
    htmlRegion: "scroll",
  },
} satisfies NonNullable<SelectProps["builtinPlacements"]>;

export function CompactDropdownSelect({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  placeholder,
  placement = "bottom",
  disabled = false,
  className,
  style,
}: CompactDropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const empty = options.length === 0;
  const interactionDisabled = disabled || empty;

  function cancelScheduledClose(): void {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function scheduleClose(): void {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }

  function openFromHover(): void {
    cancelScheduledClose();
    if (!interactionDisabled) setOpen(true);
  }

  function handleOpenChange(nextOpen: boolean): void {
    cancelScheduledClose();
    setOpen(interactionDisabled ? false : nextOpen);
  }

  function handleChange(nextValue: string): void {
    setOpen(false);
    onChange(nextValue);
  }

  useEffect(() => {
    if (interactionDisabled) setOpen(false);
  }, [interactionDisabled]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  return (
    <div
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "compact-dropdown-select",
        name: "CompactDropdownSelect",
        category: "switching",
        origin: "project",
        status: "candidate",
      })}
      className={["human2ai-compact-dropdown-select", className].filter(Boolean).join(" ")}
      data-open={open ? "true" : "false"}
      data-placement={placement}
      data-empty={empty ? "true" : "false"}
      onMouseEnter={openFromHover}
      onMouseLeave={scheduleClose}
      style={style}
    >
      <Select<string, CompactDropdownSelectOption>
        aria-label={ariaLabel}
        className="human2ai-compact-dropdown-select__control"
        classNames={{
          content: "human2ai-compact-dropdown-select__value",
          suffix: "human2ai-compact-dropdown-select__suffix",
          popup: {
            root: "human2ai-compact-dropdown-select__popup",
            list: "human2ai-compact-dropdown-select__list",
            listItem: "human2ai-compact-dropdown-select__option",
          },
        }}
        builtinPlacements={connectedPlacements}
        disabled={interactionDisabled}
        listHeight={LIST_HEIGHT}
        onChange={handleChange}
        onOpenChange={handleOpenChange}
        open={open}
        options={options.map((option) => ({ ...option }))}
        placement={placement === "top" ? "topLeft" : "bottomLeft"}
        placeholder={placeholder}
        popupMatchSelectWidth
        popupRender={(menu) => (
          <div
            className="human2ai-compact-dropdown-select__popup-content"
            onMouseEnter={openFromHover}
            onMouseLeave={scheduleClose}
          >
            {menu}
          </div>
        )}
        showSearch={false}
        suffixIcon={(
          <DownOutlined
            className="human2ai-compact-dropdown-select__arrow"
            aria-hidden="true"
          />
        )}
        value={value}
        virtual={false}
      />
    </div>
  );
}
