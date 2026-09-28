"use client";

import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";
import { NumberBadge } from "../components/NumberBadge";
import { CascadeSelectorStore } from "../internal/cascadeSelectorStore";
import { uiAssetAttributes } from "../internal/uiAssetAttributes";
import "../../styles/tokens.css";
import "../../styles/cascade-selector.css";

export interface CascadeSelectorOption {
  /** Unique among siblings. Use immutable objects and arrays when updating data. */
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  children?: readonly CascadeSelectorOption[];
}

export interface CascadeSelectorColumn {
  /** Optional accessible name; columns have no visible headings. */
  "aria-label"?: string;
  /** Relative share of the total width. Defaults to 1. */
  width?: number;
  /** Minimum column width in px. Defaults to 144; narrow containers scroll internally. */
  minWidth?: number;
  loading?: boolean;
  error?: ReactNode;
}

export interface CascadeSelectorLabels {
  level: (level: number) => string;
  search: string;
  searchPlaceholder: string;
  clearSearch: string;
  chooseParent: string;
  empty: string;
  noChildren: string;
  loading: string;
  descendantMatches: (count: number) => string;
  searchResults: (count: number) => string;
}

export interface CascadeSelectorProps {
  /** Optional content to the left of the shared search field. */
  title?: ReactNode;
  options: readonly CascadeSelectorOption[];
  /** At least two columns; include every data level, even when a branch ends early. */
  columns: readonly CascadeSelectorColumn[];
  "aria-label": string;
  value?: readonly string[];
  defaultValue?: readonly string[];
  /** Emits the complete valid prefix, truncating every level after the changed choice. */
  onChange?: (value: string[], selectedOptions: CascadeSelectorOption[]) => void;
  disabled?: boolean;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  labels?: Partial<CascadeSelectorLabels>;
  /** Non-interactive decoration around the supplied highlighted label. Keep this callback stable. */
  renderOption?: (option: CascadeSelectorOption, highlightedLabel: ReactNode) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_LABELS: CascadeSelectorLabels = {
  level: (level) => `第 ${level} 级选项`,
  search: "搜索所有层级",
  searchPlaceholder: "搜索所有层级的选项",
  clearSearch: "清空搜索",
  chooseParent: "请先选择上一级",
  empty: "暂无选项",
  noChildren: "该选项没有下级",
  loading: "正在加载选项",
  descendantMatches: (count) => `下级有 ${count} 项匹配`,
  searchResults: (count) => count ? `匹配 ${count} 项` : "未找到匹配项",
};

// Transient scrollbar presentation stays outside React selection/search state.
function useScrollIndicator(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      element.dataset.scrolling = "true";
      clearTimeout(timeout);
      timeout = setTimeout(() => { delete element.dataset.scrolling; }, 600);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      clearTimeout(timeout);
      delete element.dataset.scrolling;
    };
  }, [ref]);
}

type Shared = { store: CascadeSelectorStore; labels: CascadeSelectorLabels };

const Search = memo(function Search({ store, labels, disabled }: Shared & { disabled: boolean }) {
  const id = useId();
  const query = useSyncExternalStore(store.subscribe, store.getQuery, store.getQuery);
  const count = useSyncExternalStore(store.subscribe, store.getMatchCount, store.getMatchCount);
  const [draft, setDraft] = useState(query);
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="yisi-cascade-selector-search">
      <label htmlFor={id} className="yisi-cascade-selector-sr">{labels.search}</label>
      <div className="yisi-cascade-selector-search-control">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
        <input
          ref={input} id={id} type="search" value={draft} disabled={disabled}
          placeholder={labels.searchPlaceholder}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={(event) => { composing.current = false; store.setQuery(event.currentTarget.value); }}
          onChange={(event) => {
            setDraft(event.target.value);
            if (!composing.current) store.setQuery(event.target.value);
          }}
        />
        {draft && <button type="button" disabled={disabled} aria-label={labels.clearSearch} onClick={() => {
          setDraft(""); store.setQuery(""); input.current?.focus();
        }}>×</button>}
      </div>
      <span className="yisi-cascade-selector-search-status" role="status">{query.trim() ? labels.searchResults(count) : ""}</span>
    </div>
  );
});

const Option = memo(function Option({ store, labels, level, item, renderOption }: Shared & {
  level: number; item: CascadeSelectorOption; renderOption?: CascadeSelectorProps["renderOption"];
}) {
  const state = useSyncExternalStore(store.subscribe, () => store.getRow(level, item), () => store.getRow(level, item));
  const match = useSyncExternalStore(store.subscribe, () => store.getMatch(item), () => store.getMatch(item));
  const hintId = useId();
  const parts: ReactNode[] = [];
  let end = 0;
  for (const [start, next] of match.ranges) {
    parts.push(item.label.slice(end, start), <mark key={start}>{item.label.slice(start, next)}</mark>);
    end = next;
  }
  parts.push(item.label.slice(end));
  const label = <span className="yisi-cascade-selector-option-label">{parts}</span>;
  const selected = Boolean(state & 1);
  return (
    <button
      type="button" role="radio" aria-label={item.label} aria-checked={selected}
      aria-describedby={match.descendants ? hintId : undefined}
      disabled={Boolean(state & 4)} tabIndex={state & 2 ? 0 : -1}
      className="yisi-cascade-selector-option"
      data-option-key={item.key} data-match={match.ranges.length > 0 || undefined}
      onFocus={() => store.setFocus(level, item)} onClick={() => store.select(level, item)}
    >
      <span className="yisi-cascade-selector-option-main">
        {item.icon != null && <span className="yisi-cascade-selector-icon" aria-hidden="true">{item.icon}</span>}
        {renderOption ? renderOption(item, label) : label}
        {match.descendants > 0 ? (
          <span className="yisi-cascade-selector-match-badge" aria-hidden="true" title={labels.descendantMatches(match.descendants)}>
            <NumberBadge value={match.descendants} size={20} style={{
              fontSize: "var(--yisiui-font-size-xs)",
              background: "var(--yisiui-color-selection-text)",
              color: "var(--yisiui-color-text-on-primary)",
            }} />
            {match.descendants > 99 && <span className="yisi-cascade-selector-match-overflow">+</span>}
          </span>
        ) : Boolean(item.children?.length) && <span aria-hidden="true" className="yisi-cascade-selector-chevron">›</span>}
      </span>
      {match.descendants > 0 && <span id={hintId} className="yisi-cascade-selector-sr yisi-cascade-selector-match-hint">{labels.descendantMatches(match.descendants)}</span>}
    </button>
  );
});

const Column = memo(function Column({ store, labels, level, column, disabled, renderOption }: Shared & {
  level: number; column: CascadeSelectorColumn; disabled: boolean; renderOption?: CascadeSelectorProps["renderOption"];
}) {
  const snapshot = useSyncExternalStore(store.subscribe, () => store.getColumn(level), () => store.getColumn(level));
  const list = useRef<HTMLDivElement>(null);
  useScrollIndicator(list);
  const previous = useRef(snapshot);
  const hadFocus = useRef(false);
  const unavailable = disabled || column.loading || column.error != null;

  useLayoutEffect(() => {
    if (previous.current !== snapshot) {
      if (list.current) list.current.scrollTop = 0;
      // If externally replaced data removes a focused row, keep focus in its column.
      if (hadFocus.current && document.activeElement === document.body) {
        const target = list.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ?? list.current;
        target?.focus({ preventScroll: true });
      }
      previous.current = snapshot;
    }
  }, [snapshot]);

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.getAttribute("role") !== "radio") return;
    const choices = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
    const index = choices.indexOf(target as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    switch (event.key) {
      case "ArrowDown": next = choices[(index + 1) % choices.length]; break;
      case "ArrowUp": next = choices[(index - 1 + choices.length) % choices.length]; break;
      case "Home": next = choices[0]; break;
      case "End": next = choices[choices.length - 1]; break;
      case "ArrowLeft":
      case "ArrowRight": {
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        const forward = (event.key === "ArrowRight") !== rtl;
        const sibling = forward ? event.currentTarget.parentElement?.nextElementSibling : event.currentTarget.parentElement?.previousElementSibling;
        next = sibling?.querySelector<HTMLButtonElement>('[role="radio"][tabindex="0"]:not(:disabled)') ?? undefined;
        event.preventDefault();
        next?.focus();
        next?.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      default: return;
    }
    event.preventDefault();
    next?.focus();
    next?.click();
    next?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  let message: ReactNode = null;
  if (column.loading) message = labels.loading;
  else if (column.error != null) message = column.error;
  else if (!snapshot.items.length) message = snapshot.waiting ? labels.chooseParent : snapshot.parent ? labels.noChildren : labels.empty;

  return (
    <div className="yisi-cascade-selector-column" data-level={level}>
      <div
        ref={list} role="radiogroup" aria-label={column["aria-label"] || labels.level(level + 1)} aria-orientation="vertical"
        aria-disabled={unavailable || undefined} aria-busy={column.loading || undefined}
        className="yisi-cascade-selector-list" tabIndex={message != null || unavailable || snapshot.items.every((item) => item.disabled) ? 0 : -1}
        onKeyDown={keyboard}
        onFocusCapture={() => { hadFocus.current = true; }}
        onBlurCapture={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) hadFocus.current = false;
        }}
      >
        {message != null ? <div className="yisi-cascade-selector-message" role={column.error != null && !column.loading ? "alert" : "status"}>{message}</div>
          : snapshot.items.map((item) => <Option key={item.key} store={store} labels={labels} level={level} item={item} renderOption={renderOption} />)}
      </div>
    </div>
  );
});

type ViewProps = Shared & Pick<CascadeSelectorProps, "columns" | "title" | "aria-label" | "renderOption" | "className" | "style" | "width" | "height"> & { disabled: boolean };
const View = memo(function View({ store, labels, columns, disabled, renderOption, width = "100%", height = 360, ...props }: ViewProps) {
  const scroll = useRef<HTMLDivElement>(null);
  useScrollIndicator(scroll);
  const tracks = columns.map((column) => `minmax(${column.minWidth ?? 144}px, ${column.width ?? 1}fr)`).join(" ");
  return (
    <div {...uiAssetAttributes("cascade-selector", "CascadeSelector")} role="group" aria-label={props["aria-label"]}
      className={["yisi-cascade-selector", props.className].filter(Boolean).join(" ")}
      style={{ width, height, ...props.style }}>
      <div className="yisi-cascade-selector-header">
        {props.title != null && <div className="yisi-cascade-selector-title">{props.title}</div>}
        <Search store={store} labels={labels} disabled={disabled} />
      </div>
      <div ref={scroll} className="yisi-cascade-selector-columns" style={{ gridTemplateColumns: tracks }}>
        {columns.map((column, level) => <Column key={level} store={store} labels={labels} column={column} level={level} disabled={disabled} renderOption={renderOption} />)}
      </div>
    </div>
  );
});

export const CascadeSelector = memo(function CascadeSelector(props: CascadeSelectorProps) {
  for (const column of props.columns) {
    if ((column.width !== undefined && (!Number.isFinite(column.width) || column.width <= 0))
      || (column.minWidth !== undefined && (!Number.isFinite(column.minWidth) || column.minWidth <= 0))) {
      throw new Error("CascadeSelector 每栏的 width/minWidth 必须为正数");
    }
  }
  const [store] = useState(() => new CascadeSelectorStore(props));
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...props.labels }), [props.labels]);
  // Synchronize controlled values after commit, never mutate the store during render.
  useLayoutEffect(() => { store.configure(props); }, [store, props]);
  return <View store={store} labels={labels} columns={props.columns} title={props.title} aria-label={props["aria-label"]}
    disabled={Boolean(props.disabled)} renderOption={props.renderOption} width={props.width} height={props.height}
    className={props.className} style={props.style} />;
});
