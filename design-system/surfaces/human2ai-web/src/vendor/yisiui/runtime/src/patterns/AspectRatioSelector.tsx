"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useRef, useState } from "react";

import "../../styles/tokens.css";
import "../../styles/aspect-ratio-selector.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface AspectRatioOption {
  key: string;
  label: string;
  width: number;
  height: number;
  disabled?: boolean;
  ariaLabel?: string;
}

export const DEFAULT_ASPECT_RATIO_OPTIONS = [
  { key: "16:9", label: "16:9", width: 16, height: 9 },
  { key: "9:16", label: "9:16", width: 9, height: 16 },
  { key: "4:3", label: "4:3", width: 4, height: 3 },
  { key: "3:4", label: "3:4", width: 3, height: 4 },
  { key: "3:2", label: "3:2", width: 3, height: 2 },
  { key: "1:1", label: "1:1", width: 1, height: 1 },
  { key: "2:3", label: "2:3", width: 2, height: 3 },
] as const satisfies readonly AspectRatioOption[];

export interface AspectRatioSelectorProps {
  options?: readonly AspectRatioOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (key: string, option: AspectRatioOption) => void;
  title?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface PreviewStyle extends CSSProperties {
  "--yisiui-aspect-ratio-preview-width": string;
  "--yisiui-aspect-ratio-preview-height": string;
}

const OPTION_POSITIONS = [
  "left-top",
  "right-top",
  "left-middle",
  "right-middle",
  "left-bottom",
  "center-bottom",
  "right-bottom",
] as const;

function validateOptions(
  options: readonly AspectRatioOption[],
  value: string | undefined,
  defaultValue: string | undefined,
): void {
  if (options.length === 0 || options.length > OPTION_POSITIONS.length) {
    throw new Error("AspectRatioSelector 需要 1 至 7 个比例选项。");
  }

  const keys = new Set<string>();
  for (const option of options) {
    if (keys.has(option.key)) {
      throw new Error(`AspectRatioSelector 选项 key 必须唯一：${option.key}`);
    }
    if (
      !Number.isFinite(option.width) ||
      option.width <= 0 ||
      !Number.isFinite(option.height) ||
      option.height <= 0
    ) {
      throw new Error(`AspectRatioSelector 比例必须是正数：${option.key}`);
    }
    keys.add(option.key);
  }

  if (value !== undefined && !keys.has(value)) {
    throw new Error(`AspectRatioSelector value 不存在于 options：${value}`);
  }
  if (defaultValue !== undefined && !keys.has(defaultValue)) {
    throw new Error(`AspectRatioSelector defaultValue 不存在于 options：${defaultValue}`);
  }
}

function getFirstEnabledKey(options: readonly AspectRatioOption[]): string {
  return options.find((option) => !option.disabled)?.key ?? options[0].key;
}

function getNextEnabledIndex(
  options: readonly AspectRatioOption[],
  currentIndex: number,
  direction: 1 | -1,
): number {
  for (let offset = 1; offset <= options.length; offset += 1) {
    const nextIndex = (currentIndex + offset * direction + options.length) % options.length;
    if (!options[nextIndex].disabled) {
      return nextIndex;
    }
  }
  return currentIndex;
}

function getLastEnabledIndex(options: readonly AspectRatioOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index].disabled) {
      return index;
    }
  }
  return -1;
}

function getPreviewStyle(option: AspectRatioOption): PreviewStyle {
  const maxWidth = 62;
  const maxHeight = 60;
  const scale = Math.min(maxWidth / option.width, maxHeight / option.height);
  return {
    "--yisiui-aspect-ratio-preview-width": `${Math.max(12, option.width * scale)}px`,
    "--yisiui-aspect-ratio-preview-height": `${Math.max(12, option.height * scale)}px`,
  };
}

export function AspectRatioSelector({
  options = DEFAULT_ASPECT_RATIO_OPTIONS,
  value,
  defaultValue,
  onChange,
  title = "比例",
  "aria-label": ariaLabel = "比例选择",
  disabled = false,
  className,
  style,
}: AspectRatioSelectorProps) {
  validateOptions(options, value, defaultValue);

  const firstEnabledKey = getFirstEnabledKey(options);
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstEnabledKey);
  const optionByKey = new Map(options.map((option) => [option.key, option]));
  const fallbackKey = optionByKey.has(internalValue) ? internalValue : firstEnabledKey;
  const selectedKey = value ?? fallbackKey;
  const selectedOption = optionByKey.get(selectedKey) ?? options[0];
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectOption(option: AspectRatioOption): void {
    if (disabled || option.disabled) {
      return;
    }
    if (value === undefined) {
      setInternalValue(option.key);
    }
    onChange?.(option.key, option);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = getNextEnabledIndex(options, index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = getNextEnabledIndex(options, index, -1);
    } else if (event.key === "Home") {
      nextIndex = options.findIndex((option) => !option.disabled);
    } else if (event.key === "End") {
      nextIndex = getLastEnabledIndex(options);
    }

    if (nextIndex === null || nextIndex < 0 || nextIndex === index) {
      return;
    }
    event.preventDefault();
    selectOption(options[nextIndex]);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      {...uiAssetAttributes(
        "aspect-ratio-selector",
        "AspectRatioSelector",
        "selection-pattern",
      )}
      className={["yisi-aspect-ratio-selector", className].filter(Boolean).join(" ")}
      style={style}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      <div className="yisi-aspect-ratio-selector-title">{title}</div>
      <div
        className="yisi-aspect-ratio-selector-preview-area"
        aria-live="polite"
        aria-label={`当前比例：${selectedOption.label}`}
      >
        <span className="yisi-aspect-ratio-selector-current">当前比例：{selectedOption.label}</span>
        <span
          className="yisi-aspect-ratio-selector-preview"
          style={getPreviewStyle(selectedOption)}
          data-ratio={selectedOption.key}
          aria-hidden="true"
        />
      </div>
      {options.map((option, index) => {
        const selected = option.key === selectedKey;
        return (
          <button
            key={option.key}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            className="yisi-aspect-ratio-selector-option"
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            title={option.label}
            data-ratio-key={option.key}
            data-position={OPTION_POSITIONS[index]}
            disabled={disabled || option.disabled}
            tabIndex={
              selected || (selectedOption.disabled && option.key === firstEnabledKey) ? 0 : -1
            }
            onClick={() => selectOption(option)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
