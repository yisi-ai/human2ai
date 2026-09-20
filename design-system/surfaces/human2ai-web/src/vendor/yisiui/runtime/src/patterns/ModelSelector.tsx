"use client";

import { CheckOutlined, DownOutlined, MoreOutlined } from "@ant-design/icons";
import { Dropdown, Slider } from "antd";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import "../../styles/tokens.css";
import "../../styles/model-selector.css";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";

export interface ModelSelectorReasoningLevel {
  key: string;
  label: string;
}

export interface ModelSelectorOption {
  key: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Ordered, discrete levels supplied by the consumer; absent means unsupported. */
  reasoningLevels?: readonly ModelSelectorReasoningLevel[];
}

export interface ModelSelectorSource {
  key: string;
  label: string;
  disabled?: boolean;
  models: readonly ModelSelectorOption[];
}

export interface ModelSelectorMode {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  sources: readonly ModelSelectorSource[];
}

export interface ModelSelectorValue {
  modeKey: string;
  sourceKey?: string;
  modelKey?: string;
  reasoningKey?: string;
}

export interface ModelSelectorLabels {
  modes: string;
  models: string;
  moreModels: string;
  selectSource: (mode: string) => string;
  reasoning: string;
  noReasoning: string;
  empty: string;
  loading: string;
}

export interface ModelSelectorProps {
  modes: readonly ModelSelectorMode[];
  value: ModelSelectorValue | null;
  onChange: (value: ModelSelectorValue) => void;
  title?: ReactNode;
  "aria-label"?: string;
  labels?: Partial<ModelSelectorLabels>;
  /** Vertical places modes beside the content; horizontal places them beside the title. */
  modeLayout?: "vertical" | "horizontal";
  /** Maximum inline models. The current model remains visible after overflow selection. */
  visibleModelCount?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const defaultLabels: ModelSelectorLabels = {
  modes: "模式",
  models: "模型型号",
  moreModels: "更多模型",
  selectSource: (mode) => `选择 ${mode} 来源`,
  reasoning: "推理强度",
  noReasoning: "此模型不支持推理强度调节",
  empty: "暂无可用模型",
  loading: "正在加载模型",
};

// Seeded randomness keeps the scattered stars stable across renders and hydration.
const reasoningStars: CSSProperties[] = (() => {
  let seed = 682619;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: 20 }, () => {
    const size = 1.5 + random() * 1.5;
    return { left: `${3 + random() * 94}%`, top: `${14 + random() * 72}%`,
      width: size, height: size, animationDelay: `${-random() * 6}s`,
      animationDuration: `${2.8 + random() * 3}s` };
  });
})();

type Popup = { kind: "models" } | { kind: "sources"; modeKey: string };
type Choice = Pick<ModelSelectorOption, "key" | "label" | "description" | "disabled">;
const menuWidth = 170;
const menuGap = 8;

/** Radio groups select with arrows; menus move focus and select with Enter/Space. */
function moveFocus(event: KeyboardEvent, selector: string, select: boolean) {
  const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1
    : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
  if (!direction && event.key !== "Home" && event.key !== "End") return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(selector))
    .filter((button) => !button.disabled);
  if (!buttons.length) return;
  event.preventDefault();
  const current = buttons.indexOf(event.target as HTMLButtonElement);
  const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
    : (current + direction + buttons.length) % buttons.length;
  buttons[index].focus();
  if (select) buttons[index].click();
}

function ChoiceMenu({ id, label, options, selectedKey, onSelect }: {
  id: string;
  label: string;
  options: readonly Choice[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}) {
  const tabStop = options.find((option) => option.key === selectedKey && !option.disabled) ??
    options.find((option) => !option.disabled);
  return (
    <div id={id} className="yisi-model-selector-menu" role="menu" aria-label={label} tabIndex={tabStop ? -1 : 0}
      onKeyDown={(event) => moveFocus(event, '[role="menuitemradio"]', false)}>
      {options.map((option) => (
        <button key={option.key} type="button" role="menuitemradio" aria-checked={option.key === selectedKey}
          className="yisi-model-selector-menu-item" disabled={option.disabled} tabIndex={option === tabStop ? 0 : -1}
          title={option.description ? `${option.label} — ${option.description}` : option.label}
          onClick={() => onSelect(option.key)}>
          <span className="yisi-model-selector-menu-copy">
            <span>{option.label}</span>
            {option.description && <small>{option.description}</small>}
          </span>
          <CheckOutlined className="yisi-model-selector-check" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function ModelSelector({
  modes, value, onChange, title = "模型选择", "aria-label": ariaLabel = "模型选择",
  labels: suppliedLabels, modeLayout = "vertical", visibleModelCount = 3, disabled = false, loading = false,
  error, className, style,
}: ModelSelectorProps) {
  const labels = { ...defaultLabels, ...suppliedLabels };
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const errorId = useId();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [stackedModelMenu, setStackedModelMenu] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Each portal keeps its own id while another portal's exit animation finishes.
  const activeMenuId = popup?.kind === "models" ? `${menuId}-models`
    : `${menuId}-sources-${modes.findIndex((item) => item.key === (popup?.kind === "sources" ? popup.modeKey : undefined))}`;
  const locked = disabled || loading;
  const mode = modes.find((item) => item.key === value?.modeKey) ?? modes.find((item) => !item.disabled);
  const source = mode?.sources.find((item) => item.key === value?.sourceKey) ?? mode?.sources.find((item) => !item.disabled);
  const models = source?.models ?? [];
  const model = value?.modeKey === mode?.key && value?.sourceKey === source?.key
    ? models.find((item) => item.key === value?.modelKey) : undefined;
  const levels = model?.reasoningLevels ?? [];
  const reasoningIndex = Math.max(0, levels.findIndex((item) => item.key === value?.reasoningKey));
  const highestReasoning = levels.length > 1 && reasoningIndex === levels.length - 1;
  const modelLocked = locked || !mode || mode.disabled || !source || source.disabled;
  const limit = Number.isFinite(visibleModelCount) ? Math.max(1, Math.floor(visibleModelCount)) : 3;
  const visibleModels = models.slice(0, limit);
  if (model && !visibleModels.includes(model)) visibleModels[visibleModels.length - 1] = model;
  const firstMode = modes.find((item) => !item.disabled);
  const firstModel = visibleModels.find((item) => !item.disabled);

  function updateModelMenuPlacement() {
    const body = bodyRef.current;
    if (!body) return;
    const anchor = body.getBoundingClientRect();
    const viewportWidth = body.ownerDocument.documentElement.clientWidth;
    const width = Math.min(menuWidth, Math.max(0, viewportWidth - 24));
    // When neither side fits, use a bounded dropdown above/below the content.
    setStackedModelMenu(Math.max(anchor.left, viewportWidth - anchor.right) < width + menuGap);
  }

  function closePopup(restoreFocus = true) {
    setPopup(null);
    if (restoreFocus && popup) triggerRef.current?.focus();
  }

  function togglePopup(next: Popup, trigger: HTMLButtonElement) {
    if (locked) return;
    if (popup?.kind === next.kind && (next.kind === "models" ||
      (popup.kind === "sources" && popup.modeKey === next.modeKey))) {
      closePopup();
    } else {
      if (next.kind === "models") updateModelMenuPlacement();
      triggerRef.current = trigger;
      setPopup(next);
    }
  }

  function select(nextMode: ModelSelectorMode, nextSource?: ModelSelectorSource, nextModel?: ModelSelectorOption) {
    if (locked || nextMode.disabled || nextSource?.disabled || nextModel?.disabled) return;
    const nextLevels = nextModel?.reasoningLevels ?? [];
    const nextReasoning = nextLevels.find((level) => level.key === value?.reasoningKey) ?? nextLevels[0];
    onChange({ modeKey: nextMode.key, sourceKey: nextSource?.key,
      modelKey: nextModel?.key, reasoningKey: nextReasoning?.key });
    closePopup();
  }

  function selectSource(nextMode: ModelSelectorMode, nextSource?: ModelSelectorSource) {
    select(nextMode, nextSource, nextSource?.models.find((item) => !item.disabled));
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPopup(null);
  }, [disabled, loading, value?.modeKey, value?.sourceKey, value?.modelKey, modes, modeLayout]);

  useEffect(() => {
    if (popup?.kind !== "models") return;
    const observer = new ResizeObserver(updateModelMenuPlacement);
    if (bodyRef.current) observer.observe(bodyRef.current);
    window.addEventListener("resize", updateModelMenuPlacement);
    window.addEventListener("scroll", updateModelMenuPlacement, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateModelMenuPlacement);
      window.removeEventListener("scroll", updateModelMenuPlacement, true);
    };
  }, [popup]);

  useEffect(() => {
    if (!popup) return;
    const frame = requestAnimationFrame(() => {
      const menu = document.getElementById(activeMenuId);
      (menu?.querySelector<HTMLButtonElement>('[aria-checked="true"]:not(:disabled)') ??
        menu?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? menu)?.focus();
    });
    const pointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !document.getElementById(activeMenuId)?.contains(event.target)) {
        setPopup(null);
      }
    };
    const keyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Tab") return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
      closePopup();
    };
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("keydown", keyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("keydown", keyDown, true);
    };
  }, [popup, activeMenuId]);

  const dropdownProps = {
    trigger: [] as [], arrow: false, autoAdjustOverflow: true, destroyOnHidden: true,
    classNames: { root: "yisi-model-selector-popup" },
    styles: { root: { minWidth: 0, width: menuWidth, maxWidth: "calc(100vw - 24px)" } },
    transitionName: reducedMotion ? "" : undefined,
  };

  const modeChoices = (
        <div className="yisi-model-selector-modes" role="radiogroup" aria-label={labels.modes} aria-orientation={modeLayout}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement).getAttribute("role") === "radio") moveFocus(event, '[role="radio"]', true);
          }}>
          {modes.map((item, index) => {
            const sourceMenuId = `${menuId}-sources-${index}`;
            const selected = item.key === mode?.key;
            const selectedSource = selected ? source : item.sources.find((option) => !option.disabled);
            const open = !locked && popup?.kind === "sources" && popup.modeKey === item.key;
            return (
              <div key={item.key} className="yisi-model-selector-mode" data-selected={selected}>
                <button className="yisi-model-selector-mode-button" type="button" role="radio"
                  aria-checked={selected} disabled={locked || item.disabled}
                  tabIndex={selected && !item.disabled || mode?.disabled && item === firstMode ? 0 : -1}
                  title={selectedSource ? `${item.label} · ${selectedSource.label}` : item.label}
                  onClick={() => { if (!selected) selectSource(item, item.sources.find((option) => !option.disabled)); }}>
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  <span className="yisi-model-selector-mode-label">{item.label}</span>
                </button>
                {item.sources.length > 1 && (
                  <Dropdown {...dropdownProps} placement="bottomLeft" open={open}
                    popupRender={() => <ChoiceMenu id={sourceMenuId} label={labels.selectSource(item.label)}
                      options={item.sources} selectedKey={selectedSource?.key}
                      onSelect={(key) => selectSource(item, item.sources.find((option) => option.key === key))} />}>
                    <button className="yisi-model-selector-icon-button" type="button"
                      disabled={locked || item.disabled} aria-label={labels.selectSource(item.label)}
                      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? sourceMenuId : undefined}
                      onClick={(event) => togglePopup({ kind: "sources", modeKey: item.key }, event.currentTarget)}
                      onKeyDown={(event) => { if (event.key === "ArrowDown" && !open) {
                        event.preventDefault(); togglePopup({ kind: "sources", modeKey: item.key }, event.currentTarget);
                      } }}>
                      <DownOutlined aria-hidden="true" />
                    </button>
                  </Dropdown>
                )}
              </div>
            );
          })}
        </div>
  );

  return (
    <div {...uiAssetAttributes("model-selector", "ModelSelector")} ref={rootRef}
      className={["yisi-model-selector", className].filter(Boolean).join(" ")} style={style}
      data-mode-layout={modeLayout} role="group" aria-label={ariaLabel} aria-disabled={disabled} aria-busy={loading}
      aria-describedby={error ? errorId : undefined}>
      {(title != null || modeLayout === "horizontal") && <div className="yisi-model-selector-header">
        {title != null && <div className="yisi-model-selector-title">{title}</div>}
        {modeLayout === "horizontal" && modeChoices}
      </div>}
      {/* Changing the base placement also realigns an already open Dropdown. */}
      <Dropdown {...dropdownProps} open={!modelLocked && popup?.kind === "models"}
          placement={stackedModelMenu ? "bottomRight" : "bottomLeft"}
          align={{ points: stackedModelMenu ? ["tr", "br"] : ["tl", "tr"],
            offset: stackedModelMenu ? [0, 0] : [menuGap, 0], htmlRegion: "visible",
            overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true } }}
          popupRender={() => <ChoiceMenu id={`${menuId}-models`} label={labels.models} options={models}
            selectedKey={model?.key} onSelect={(key) => {
              if (mode) select(mode, source, models.find((item) => item.key === key));
            }} />}>
        <div ref={bodyRef} className="yisi-model-selector-body">
          {modeLayout === "vertical" && modeChoices}
          <div className="yisi-model-selector-content">
            <div className="yisi-model-selector-model-row">
              <div className="yisi-model-selector-models" role="radiogroup" aria-label={labels.models}
                onKeyDown={(event) => moveFocus(event, '[role="radio"]', true)}>
                {visibleModels.map((item) => (
                  <button key={item.key} type="button" className="yisi-model-selector-model-button" role="radio"
                    aria-checked={item.key === model?.key} title={item.label} disabled={modelLocked || item.disabled}
                    tabIndex={item === model && !item.disabled || (!model || model.disabled) && item === firstModel ? 0 : -1}
                    onClick={() => { if (mode) select(mode, source, item); }}>{item.label}</button>
                ))}
              </div>
              {models.length > limit && <button className="yisi-model-selector-icon-button yisi-model-selector-more"
                type="button" disabled={modelLocked} aria-label={labels.moreModels} aria-haspopup="menu"
                aria-expanded={!modelLocked && popup?.kind === "models"}
                aria-controls={popup?.kind === "models" ? `${menuId}-models` : undefined}
                onClick={(event) => togglePopup({ kind: "models" }, event.currentTarget)}
                onKeyDown={(event) => { if (event.key === "ArrowDown" && popup?.kind !== "models") {
                  event.preventDefault(); togglePopup({ kind: "models" }, event.currentTarget);
                } }}><MoreOutlined aria-hidden="true" /></button>}
            </div>
            {loading ? <div className="yisi-model-selector-message" role="status">{labels.loading}</div>
              : !models.some((item) => !item.disabled) ? <div className="yisi-model-selector-message" role="status">{labels.empty}</div>
              : model && <div className="yisi-model-selector-reasoning">
                {levels.length > 1 ? <div className="yisi-model-selector-reasoning-control">
                  {highestReasoning && <div className="yisi-model-selector-stars" aria-hidden="true"
                    data-animated={!reducedMotion && !modelLocked && !model.disabled}>
                    {reasoningStars.map((star, index) => <span key={index} style={star} />)}
                  </div>}
                  <Slider className="yisi-model-selector-slider" min={0} max={levels.length - 1} step={1} dots
                    value={reasoningIndex} disabled={modelLocked || model.disabled}
                    marks={Object.fromEntries(levels.map((level, index) => [index, level.label]))}
                    ariaLabelForHandle={labels.reasoning}
                    ariaValueTextFormatterForHandle={(index) => levels[index]?.label ?? ""}
                    tooltip={{ formatter: (index) => levels[index ?? 0]?.label }}
                    onChange={(index) => { if (mode && !modelLocked && !model.disabled) onChange({ modeKey: mode.key,
                      sourceKey: source?.key, modelKey: model.key, reasoningKey: levels[index].key }); }} />
                </div> : <div className="yisi-model-selector-message" role="group" aria-label={labels.reasoning}>
                  {levels[0]?.label ?? labels.noReasoning}
                </div>}
              </div>}
          </div>
        </div>
      </Dropdown>
      {error && <div id={errorId} className="yisi-model-selector-error" role="alert">{error}</div>}
    </div>
  );
}
