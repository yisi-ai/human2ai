export function styleModelGlb(patch: Record<string, unknown> = {}): Buffer {
  const document = {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }],
    ...patch,
  };
  const json = Buffer.from(JSON.stringify(document));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const result = Buffer.alloc(20 + paddedLength + 8 + 36);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(paddedLength, 12); result.writeUInt32LE(0x4e4f534a, 16);
  result.fill(0x20, 20, 20 + paddedLength); json.copy(result, 20);
  result.writeUInt32LE(36, 20 + paddedLength); result.writeUInt32LE(0x004e4942, 24 + paddedLength);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => result.writeFloatLE(value, 28 + paddedLength + index * 4));
  return result;
}
