"use client";

import type { ChangeEvent, CSSProperties, FocusEvent, KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

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

export interface AspectRatioValue {
  width: number;
  height: number;
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
  ratio?: AspectRatioValue;
  defaultRatio?: AspectRatioValue;
  onRatioChange?: (ratio: AspectRatioValue, matchedOption?: AspectRatioOption) => void;
  title?: string;
  widthLabel?: string;
  heightLabel?: string;
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
  ratio: AspectRatioValue | undefined,
  defaultRatio: AspectRatioValue | undefined,
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

  validateRatio(ratio, "ratio");
  validateRatio(defaultRatio, "defaultRatio");
}

function validateRatio(ratio: AspectRatioValue | undefined, propName: string): void {
  if (
    ratio !== undefined &&
    (!Number.isFinite(ratio.width) ||
      ratio.width <= 0 ||
      !Number.isFinite(ratio.height) ||
      ratio.height <= 0)
  ) {
    throw new Error(`AspectRatioSelector ${propName} 的宽高必须是正数。`);
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

function getPreviewStyle(ratio: AspectRatioValue): PreviewStyle {
  const maxWidth = 62;
  const maxHeight = 60;
  const scale = Math.min(maxWidth / ratio.width, maxHeight / ratio.height);
  return {
    "--yisiui-aspect-ratio-preview-width": `${Math.max(12, ratio.width * scale)}px`,
    "--yisiui-aspect-ratio-preview-height": `${Math.max(12, ratio.height * scale)}px`,
  };
}

function ratioFromOption(option: AspectRatioOption): AspectRatioValue {
  return { width: option.width, height: option.height };
}

function ratiosEqual(left: AspectRatioValue, right: AspectRatioValue): boolean {
  const leftProduct = left.width * right.height;
  const rightProduct = right.width * left.height;
  const tolerance = Math.max(1, Math.abs(leftProduct), Math.abs(rightProduct)) * 1e-9;
  return Math.abs(leftProduct - rightProduct) <= tolerance;
}

function findMatchingOption(
  options: readonly AspectRatioOption[],
  ratio: AspectRatioValue,
): AspectRatioOption | undefined {
  return options.find((option) => ratiosEqual(option, ratio));
}

function formatRatioPart(value: number): string {
  return String(value);
}

function parseRatioPart(value: string): number | null {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function AspectRatioSelector({
  options = DEFAULT_ASPECT_RATIO_OPTIONS,
  value,
  defaultValue,
  onChange,
  ratio,
  defaultRatio,
  onRatioChange,
  title = "比例",
  widthLabel = "w",
  heightLabel = "h",
  "aria-label": ariaLabel = "比例选择",
  disabled = false,
  className,
  style,
}: AspectRatioSelectorProps) {
  validateOptions(options, value, defaultValue, ratio, defaultRatio);

  const firstEnabledKey = getFirstEnabledKey(options);
  const optionByKey = new Map(options.map((option) => [option.key, option]));
  const defaultOption = optionByKey.get(defaultValue ?? firstEnabledKey) ?? options[0];
  const initialRatio = defaultRatio ?? ratioFromOption(defaultOption);
  const [internalRatio, setInternalRatio] = useState<AspectRatioValue>(initialRatio);
  const [internalSelectedKey, setInternalSelectedKey] = useState<string | null>(() => {
    if (defaultRatio !== undefined) {
      return findMatchingOption(options, defaultRatio)?.key ?? null;
    }
    return defaultOption.key;
  });
  const controlledOption = value === undefined ? undefined : optionByKey.get(value);
  const currentRatio = ratio ?? (controlledOption ? ratioFromOption(controlledOption) : internalRatio);
  const preferredOption = optionByKey.get(value ?? internalSelectedKey ?? "");
  const matchedOption =
    preferredOption && ratiosEqual(preferredOption, currentRatio)
      ? preferredOption
      : findMatchingOption(options, currentRatio);
  const selectedKey = matchedOption?.key ?? null;
  const [widthInput, setWidthInput] = useState(() => formatRatioPart(currentRatio.width));
  const [heightInput, setHeightInput] = useState(() => formatRatioPart(currentRatio.height));
  const inputId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (ratio !== undefined || value !== undefined) {
      setWidthInput(formatRatioPart(currentRatio.width));
      setHeightInput(formatRatioPart(currentRatio.height));
    }
  }, [currentRatio.height, currentRatio.width, ratio, value]);

  function requestRatioChange(nextRatio: AspectRatioValue): void {
    const nextMatchedOption = findMatchingOption(options, nextRatio);
    if (ratio === undefined && value === undefined) {
      setInternalRatio(nextRatio);
      setInternalSelectedKey(nextMatchedOption?.key ?? null);
    }
    onRatioChange?.(nextRatio, nextMatchedOption);
  }

  function selectOption(option: AspectRatioOption): void {
    if (disabled || option.disabled) {
      return;
    }
    const nextRatio = ratioFromOption(option);
    if (ratio === undefined && value === undefined) {
      setInternalRatio(nextRatio);
      setInternalSelectedKey(option.key);
      setWidthInput(formatRatioPart(nextRatio.width));
      setHeightInput(formatRatioPart(nextRatio.height));
    }
    onChange?.(option.key, option);
    onRatioChange?.(nextRatio, option);
  }

  function handleRatioInputChange(
    dimension: keyof AspectRatioValue,
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const nextInput = event.currentTarget.value;
    const nextWidthInput = dimension === "width" ? nextInput : widthInput;
    const nextHeightInput = dimension === "height" ? nextInput : heightInput;

    if (dimension === "width") {
      setWidthInput(nextInput);
    } else {
      setHeightInput(nextInput);
    }

    const nextWidth = parseRatioPart(nextWidthInput);
    const nextHeight = parseRatioPart(nextHeightInput);
    if (nextWidth !== null && nextHeight !== null) {
      requestRatioChange({ width: nextWidth, height: nextHeight });
    }
  }

  function handleRatioInputBlur(
    dimension: keyof AspectRatioValue,
    event: FocusEvent<HTMLInputElement>,
  ): void {
    if (
      parseRatioPart(event.currentTarget.value) !== null &&
      ratio === undefined &&
      value === undefined
    ) {
      return;
    }
    if (dimension === "width") {
      setWidthInput(formatRatioPart(currentRatio.width));
    } else {
      setHeightInput(formatRatioPart(currentRatio.height));
    }
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
      aria-disabled={disabled}
    >
      <div className="yisi-aspect-ratio-selector-header">
        <span className="yisi-aspect-ratio-selector-title" title={title}>
          {title}
        </span>
        <div className="yisi-aspect-ratio-selector-inputs">
          <label className="yisi-aspect-ratio-selector-input-label">
            <span>{widthLabel}</span>
            <input
              id={`${inputId}-width`}
              className="yisi-aspect-ratio-selector-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              autoComplete="off"
              aria-label={widthLabel}
              aria-invalid={parseRatioPart(widthInput) === null}
              disabled={disabled}
              value={widthInput}
              onChange={(event) => handleRatioInputChange("width", event)}
              onBlur={(event) => handleRatioInputBlur("width", event)}
            />
          </label>
          <span className="yisi-aspect-ratio-selector-multiply" aria-hidden="true">
            ×
          </span>
          <label className="yisi-aspect-ratio-selector-input-label">
            <span>{heightLabel}</span>
            <input
              id={`${inputId}-height`}
              className="yisi-aspect-ratio-selector-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              autoComplete="off"
              aria-label={heightLabel}
              aria-invalid={parseRatioPart(heightInput) === null}
              disabled={disabled}
              value={heightInput}
              onChange={(event) => handleRatioInputChange("height", event)}
              onBlur={(event) => handleRatioInputBlur("height", event)}
            />
          </label>
        </div>
      </div>
      <div
        className="yisi-aspect-ratio-selector-options"
        role="radiogroup"
        aria-label={ariaLabel}
        aria-disabled={disabled}
      >
        <div
          className="yisi-aspect-ratio-selector-preview-area"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="yisi-aspect-ratio-selector-current">
            {title}: {formatRatioPart(currentRatio.width)} × {formatRatioPart(currentRatio.height)}
          </span>
          <span
            className="yisi-aspect-ratio-selector-preview"
            style={getPreviewStyle(currentRatio)}
            data-ratio={selectedKey ?? `${currentRatio.width}:${currentRatio.height}`}
            data-ratio-value={`${currentRatio.width}:${currentRatio.height}`}
            aria-hidden="true"
          />
        </div>
        {options.map((option, index) => {
          const selected = option.key === selectedKey;
          const selectedOptionIsDisabled = matchedOption?.disabled ?? false;
          const fallbackTabStop =
            (selectedKey === null || selectedOptionIsDisabled) && option.key === firstEnabledKey;
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
              tabIndex={selected || fallbackTabStop ? 0 : -1}
              onClick={() => selectOption(option)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
