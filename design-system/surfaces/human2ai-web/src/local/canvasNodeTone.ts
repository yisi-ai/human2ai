// Keep a node's marker stable across deletion, reordering and state changes.
export function canvasNodeTone(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(index)) >>> 0;
  }
  return hash % 6;
}
