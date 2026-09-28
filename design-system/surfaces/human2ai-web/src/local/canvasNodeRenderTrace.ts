// Opt-in development diagnostics for browser render-scope assertions.
let counts: Map<string, number> | undefined;

export function canvasNodeExecutionCounts(): ReadonlyMap<string, number> {
  return counts ??= new Map();
}

export function recordCanvasNodeExecution(id: string): void {
  if (counts) counts.set(id, (counts.get(id) ?? 0) + 1);
}
