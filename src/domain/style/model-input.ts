export const MAX_STYLE_MODEL_BYTES = 10 * 1024 * 1024;

/** Accept a self-contained, static GLB example, never executable generator code. */
export function validStyleModel(data: Buffer): boolean {
  if (!Buffer.isBuffer(data) || data.length < 28 || data.length > MAX_STYLE_MODEL_BYTES) return false;
  if (data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) return false;
  const jsonLength = data.readUInt32LE(12);
  if (jsonLength % 4 || 20 + jsonLength > data.length || data.readUInt32LE(16) !== 0x4e4f534a) return false;
  try {
    const document = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
    if (document.asset?.version !== "2.0" || !document.scenes?.length || !document.nodes?.length || !document.meshes?.length) return false;
    // Textures and geometry must live in this file, with no decoder dependencies.
    if (document.extensionsRequired?.some((name: string) => ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(name))) return false;
    if (JSON.stringify(document).includes('"uri":')) return false;
    const binaryOffset = 20 + jsonLength;
    if (binaryOffset + 8 > data.length || data.readUInt32LE(binaryOffset + 4) !== 0x004e4942) return false;
    const binaryLength = data.readUInt32LE(binaryOffset);
    if (binaryLength % 4 || binaryOffset + 8 + binaryLength !== data.length) return false;
    if (document.buffers?.length !== 1 || !Number.isInteger(document.buffers[0].byteLength) || document.buffers[0].byteLength <= 0 || document.buffers[0].byteLength > binaryLength) return false;
    return Array.isArray(document.bufferViews) && document.bufferViews.every((view: { buffer: number; byteOffset?: number; byteLength: number }) => (
      view.buffer === 0 && Number.isInteger(view.byteOffset ?? 0) && (view.byteOffset ?? 0) >= 0
      && Number.isInteger(view.byteLength) && view.byteLength > 0
      && (view.byteOffset ?? 0) + view.byteLength <= document.buffers[0].byteLength
    ));
  } catch { return false; }
}
