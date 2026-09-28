export type SessionPreviewSource = { sessionId: string } & (
  | { sessionType: "spatial"; cameraId: string }
  | { sessionType: "image-composition" | "ui-layout"; stateId: string }
);

export type SessionPreviewReference = SessionPreviewSource & { renderedRevision: number };

export function previewSourceKey(source: SessionPreviewSource): string {
  return JSON.stringify([source.sessionId, source.sessionType, source.sessionType === "spatial" ? source.cameraId : source.stateId]);
}

/** Consumer -> sources. Freeze each cyclic group, then refresh its downstream groups.
 * The initiating session is already processed and is never revisited in this wave. */
export function previewWaveGroups(root: string, dependencies: ReadonlyMap<string, readonly string[]>): string[][] {
  const affected = new Set<string>([root]);
  for (const source of affected) for (const [id, sources] of dependencies) {
    if (sources.includes(source)) affected.add(id);
  }
  affected.delete(root);
  let index = 0;
  const indices = new Map<string, number>(), low = new Map<string, number>();
  const stack: string[] = [], stacked = new Set<string>(), groups: string[][] = [];
  const visit = (id: string) => {
    indices.set(id, index); low.set(id, index++); stack.push(id); stacked.add(id);
    for (const source of dependencies.get(id) ?? []) {
      if (!affected.has(source)) continue;
      if (!indices.has(source)) { visit(source); low.set(id, Math.min(low.get(id)!, low.get(source)!)); }
      else if (stacked.has(source)) low.set(id, Math.min(low.get(id)!, indices.get(source)!));
    }
    if (low.get(id) === indices.get(id)) {
      const group: string[] = [];
      let member: string;
      do { member = stack.pop()!; stacked.delete(member); group.push(member); } while (member !== id);
      groups.push(group.sort());
    }
  };
  for (const id of affected) if (!indices.has(id)) visit(id);
  return groups;
}
