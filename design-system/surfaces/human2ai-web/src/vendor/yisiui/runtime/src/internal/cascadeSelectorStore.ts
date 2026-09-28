import type { CascadeSelectorOption, CascadeSelectorProps } from "../patterns/CascadeSelector";

type Listener = () => void;
export type Match = { readonly ranges: readonly (readonly [number, number])[]; readonly descendants: number };
export type ColumnSnapshot = {
  readonly items: readonly CascadeSelectorOption[];
  readonly parent: CascadeSelectorOption | null;
  readonly waiting: boolean;
};
const EMPTY: readonly CascadeSelectorOption[] = [];
const WAITING_COLUMN: ColumnSnapshot = { items: EMPTY, parent: null, waiting: true };
const NO_MATCH: Match = { ranges: [], descendants: 0 };
const samePath = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((key, i) => key === b[i]);

/** Per-instance store. Subscribers read stable column/row snapshots, never the whole path. */
export class CascadeSelectorStore {
  private config: CascadeSelectorProps;
  private listeners = new Set<Listener>();
  private path: readonly string[];
  private selected: readonly CascadeSelectorOption[] = [];
  private columns: ColumnSnapshot[] = [];
  private focus = new Map<number, CascadeSelectorOption>();
  private firstEnabled: (CascadeSelectorOption | undefined)[] = [];
  private matches = new Map<CascadeSelectorOption, Match>();
  private query = "";
  private count = 0;

  constructor(config: CascadeSelectorProps) {
    this.config = config;
    this.validate(config);
    this.path = config.value ?? config.defaultValue ?? [];
    this.rebuildColumns();
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private emit() { this.listeners.forEach((listener) => listener()); }
  getColumn = (level: number) => this.columns[level] ?? WAITING_COLUMN;
  getQuery = () => this.query;
  getMatchCount = () => this.count;
  getMatch = (item: CascadeSelectorOption) => this.matches.get(item) ?? NO_MATCH;
  isDisabled = (level: number) => Boolean(this.config.disabled || this.config.columns[level]?.loading || this.config.columns[level]?.error != null);
  getRow = (level: number, item: CascadeSelectorOption) => {
    const disabled = this.isDisabled(level) || Boolean(item.disabled);
    const tab = this.focus.get(level) ?? this.selected[level] ?? this.firstEnabled[level];
    // A primitive snapshot avoids fresh objects making unrelated rows render.
    return Number(this.selected[level] === item) | (Number(!disabled && tab === item) << 1) | (Number(disabled) << 2);
  };

  configure(config: CascadeSelectorProps) {
    const previous = this.config;
    const dataChanged = config.options !== previous.options || config.columns.length !== previous.columns.length;
    if (dataChanged) this.validate(config);
    this.config = config;
    const next = config.value ?? this.path;
    if (dataChanged || !samePath(next, this.path)) {
      this.path = next;
      this.rebuildColumns();
    }
    if (dataChanged) this.matchQuery();
    // React compares each subscriber's snapshot before rendering it.
    this.emit();
  }

  setFocus = (level: number, item: CascadeSelectorOption) => {
    if (this.focus.get(level) === item || this.isDisabled(level) || item.disabled) return;
    this.focus.set(level, item);
    this.emit();
  };

  select = (level: number, item: CascadeSelectorOption) => {
    if (this.isDisabled(level) || item.disabled || !this.columns[level]?.items.includes(item) || this.selected[level] === item) return;
    const path = [...this.path.slice(0, level), item.key];
    const selected = [...this.selected.slice(0, level), item];
    if (this.config.value === undefined) {
      this.path = path;
      this.rebuildColumns();
      this.emit();
    }
    this.config.onChange?.(path, selected);
  };

  setQuery = (query: string) => {
    if (this.query === query) return;
    this.query = query;
    this.matchQuery();
    this.emit();
  };

  private rebuildColumns() {
    const columns: ColumnSnapshot[] = [];
    const selected: CascadeSelectorOption[] = [];
    let items = this.config.options;
    let parent: CascadeSelectorOption | null = null;
    for (let level = 0; level < this.config.columns.length; level++) {
      const waiting = level > 0 && parent === null;
      const old = this.columns[level];
      columns.push(old?.items === items && old.parent === parent && old.waiting === waiting ? old : { items, parent, waiting });
      if (old?.items !== items || old?.parent !== parent) this.focus.delete(level);
      const item = items.find((option) => option.key === this.path[level] && !option.disabled);
      if (item && selected.length === level) selected.push(item);
      parent = item ?? null;
      items = item?.children ?? EMPTY;
    }
    this.firstEnabled = columns.map((column) => column.items.find((item) => !item.disabled));
    this.columns = columns;
    this.selected = selected;
    this.path = selected.map((item) => item.key);
  }

  private matchQuery() {
    const query = this.query.trim();
    const previous = this.matches;
    this.matches = new Map();
    this.count = 0;
    if (!query) return;
    const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
    const visit = (items: readonly CascadeSelectorOption[]): number => {
      let total = 0;
      for (const item of items) {
        const ranges = [...item.label.matchAll(expression)].map((match) => [match.index!, match.index! + match[0].length] as const);
        const descendants = visit(item.children ?? EMPTY);
        const old = previous.get(item) ?? NO_MATCH;
        const unchanged = old.descendants === descendants && old.ranges.length === ranges.length
          && old.ranges.every((range, i) => range[0] === ranges[i][0] && range[1] === ranges[i][1]);
        if (ranges.length || descendants) this.matches.set(item, unchanged ? old : { ranges, descendants });
        total += Number(ranges.length > 0) + descendants;
      }
      return total;
    };
    this.count = visit(this.config.options);
  }

  private validate(config: CascadeSelectorProps) {
    if (config.columns.length < 2) throw new Error("CascadeSelector 至少需要两栏");
    const ancestors = new Set<CascadeSelectorOption>();
    const visit = (items: readonly CascadeSelectorOption[], depth: number) => {
      if (items.length && depth >= config.columns.length) throw new Error("CascadeSelector columns 必须覆盖所有数据层级");
      const keys = new Set<string>();
      for (const item of items) {
        if (!item.key || keys.has(item.key)) throw new Error("CascadeSelector 同级选项 key 必须非空且唯一");
        if (!item.label.trim()) throw new Error("CascadeSelector 选项 label 必须非空");
        if (ancestors.has(item)) throw new Error("CascadeSelector options 不得包含循环引用");
        keys.add(item.key);
        ancestors.add(item);
        visit(item.children ?? EMPTY, depth + 1);
        ancestors.delete(item);
      }
    };
    visit(config.options, 0);
  }
}
