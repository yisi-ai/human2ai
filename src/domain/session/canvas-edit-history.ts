interface HistoryEntry<T, Context> {
  before: T;
  after: T;
  beforeContext?: Context;
  afterContext?: Context;
  group?: symbol;
}

export interface CanvasHistorySnapshot<T, Context> {
  draft: T;
  context?: Context;
}

/** In-memory operation history; server revisions remain an independent append-only log. */
export class CanvasEditHistory<T, Context = undefined> {
  private past: HistoryEntry<T, Context>[] = [];
  private future: HistoryEntry<T, Context>[] = [];
  current: T;

  constructor(initial: T) {
    this.current = structuredClone(initial);
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  record(next: T, beforeContext?: Context, afterContext = beforeContext, group?: symbol): boolean {
    if (JSON.stringify(this.current) === JSON.stringify(next)) return false;
    const previous = this.past.at(-1);
    const after = structuredClone(next);
    if (group && previous?.group === group) {
      previous.after = after;
      previous.afterContext = afterContext;
      if (JSON.stringify(previous.before) === JSON.stringify(after)) this.past.pop();
    } else {
      this.past.push({ before: this.current, after, beforeContext, afterContext, group });
      if (this.past.length > 100) this.past.shift();
    }
    this.current = after;
    this.future = [];
    return true;
  }

  undo(): CanvasHistorySnapshot<T, Context> | null {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.push(entry);
    this.current = entry.before;
    return { draft: structuredClone(this.current), context: entry.beforeContext };
  }

  redo(): CanvasHistorySnapshot<T, Context> | null {
    const entry = this.future.pop();
    if (!entry) return null;
    this.past.push(entry);
    this.current = entry.after;
    return { draft: structuredClone(this.current), context: entry.afterContext };
  }

  reset(draft: T): void {
    this.current = structuredClone(draft);
    this.past = [];
    this.future = [];
  }
}
