export function canonicalJson(input: unknown): string {
  const json = JSON.stringify(canonicalValue(input));
  if (json === undefined) throw new Error("Cannot fingerprint an undefined document.");
  return json;
}

export function fingerprintText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `draft-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function canonicalValue(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonicalValue);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, value]) => [key, canonicalValue(value)]),
  );
}
