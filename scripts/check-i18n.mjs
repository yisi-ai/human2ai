import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Ajv2020 } from "ajv/dist/2020.js";

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const metaDirectory = join(projectDirectory, "locales", "_meta");
const catalog = readJson(join(metaDirectory, "semantic-catalog.json"));
const schema = readJson(join(metaDirectory, "semantic-catalog.schema.json"));
const shardSchema = readJson(join(metaDirectory, "semantic-shard.schema.json"));
const baseline = readJson(join(metaDirectory, "legacy-baseline.json"));
const errors = [];
const frozenLegacyKeyHash =
  "sha256:5dd40385aa41a8b7d8e9d5c3dec0eb4215f7a939fd75b958088bf644559f8372";

const ajv = new Ajv2020({ allErrors: true });
const validateCatalog = ajv.compile(schema);
const validateShard = ajv.compile(shardSchema);
if (!validateCatalog(catalog)) {
  for (const error of validateCatalog.errors ?? []) {
    errors.push(`semantic catalog ${error.instancePath || "/"} ${error.message}`);
  }
}

const catalogFiles = Array.isArray(catalog.catalogs) ? catalog.catalogs : [];
if (JSON.stringify(catalogFiles) !== JSON.stringify([...catalogFiles].sort())) {
  errors.push("semantic catalog shards must be sorted");
}
const semanticsDirectory = join(metaDirectory, "semantics");
const discoveredCatalogFiles = readdirSync(semanticsDirectory, {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => `semantics/${entry.name}`)
  .sort();
if (JSON.stringify(catalogFiles) !== JSON.stringify(discoveredCatalogFiles)) {
  errors.push(
    `semantic catalog shards must match files on disk: ${discoveredCatalogFiles.join(", ")}`,
  );
}

const concepts = Object.create(null);
const semanticKeys = Object.create(null);
for (const catalogFile of catalogFiles) {
  if (
    typeof catalogFile !== "string"
    || !/^semantics\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(catalogFile)
  ) {
    continue;
  }
  const shard = readJson(join(metaDirectory, catalogFile));
  if (!validateShard(shard)) {
    for (const error of validateShard.errors ?? []) {
      errors.push(
        `${catalogFile} ${error.instancePath || "/"} ${error.message}`,
      );
    }
  }
  const expectedDomain = basename(catalogFile, ".json");
  if (shard.domain !== expectedDomain) {
    errors.push(`${catalogFile} domain must be ${expectedDomain}`);
  }
  mergeUniqueEntries(concepts, shard.concepts, "concept", catalogFile, errors);
  mergeUniqueEntries(semanticKeys, shard.keys, "key", catalogFile, errors);
}

const locales = Array.isArray(catalog.locales) ? catalog.locales : [];
const localeDirectory = join(projectDirectory, "locales");
const discoveredLocales = readdirSync(localeDirectory, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith("_") &&
      existsSync(join(localeDirectory, entry.name, "common.json")),
  )
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(locales) !== JSON.stringify(discoveredLocales)) {
  errors.push(
    `semantic catalog locales must match locale directories: ${discoveredLocales.join(", ")}`,
  );
}
const localeMaps = new Map();
for (const locale of locales) {
  const resource = readJson(
    join(projectDirectory, "locales", locale, catalog.resource),
  );
  localeMaps.set(locale, flattenStrings(resource));
}

const referenceLocale = locales[0];
const referenceMap = localeMaps.get(referenceLocale) ?? new Map();
const currentKeys = [...referenceMap.keys()].sort();
for (const locale of locales.slice(1)) {
  const localeMap = localeMaps.get(locale) ?? new Map();
  const missing = currentKeys.filter((key) => !localeMap.has(key));
  const extra = [...localeMap.keys()]
    .filter((key) => !referenceMap.has(key))
    .sort();
  if (missing.length > 0) {
    errors.push(`${locale} is missing keys: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    errors.push(`${locale} has extra keys: ${extra.join(", ")}`);
  }
}

for (const key of currentKeys) {
  const expected = placeholders(referenceMap.get(key));
  for (const locale of locales.slice(1)) {
    const actual = placeholders(localeMaps.get(locale)?.get(key));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push(
        `${key} has different placeholders in ${referenceLocale} and ${locale}`,
      );
    }
  }
}

const conceptVariants = new Map();
const canonicalConcepts = new Map();
for (const [key, metadata] of Object.entries(semanticKeys)) {
  if (!referenceMap.has(key)) {
    errors.push(`semantic key does not exist in locale resources: ${key}`);
  }
  if (!isRecord(metadata) || !(metadata.conceptId in concepts)) {
    errors.push(`${key} references an unknown concept: ${metadata?.conceptId}`);
    continue;
  }

  const identity = `${metadata.conceptId}:${metadata.variant}`;
  if (conceptVariants.has(identity)) {
    errors.push(
      `${key} duplicates concept variant ${identity} already used by ${conceptVariants.get(identity)}`,
    );
  } else {
    conceptVariants.set(identity, key);
  }

  if (metadata.reusePolicy === "canonical") {
    if (canonicalConcepts.has(metadata.conceptId)) {
      errors.push(
        `${key} is a second canonical key for ${metadata.conceptId}; reuse ${canonicalConcepts.get(metadata.conceptId)}`,
      );
    } else {
      canonicalConcepts.set(metadata.conceptId, key);
    }
  }

  const duplicateKeys = new Set();
  for (const locale of locales) {
    const localeMap = localeMaps.get(locale) ?? new Map();
    const value = localeMap.get(key);
    for (const [otherKey, otherValue] of localeMap) {
      if (otherKey !== key && otherValue === value) duplicateKeys.add(otherKey);
    }
  }
  if (duplicateKeys.size > 0 && !metadata.duplicateReason) {
    errors.push(
      `${key} renders like ${[...duplicateKeys].sort().join(", ")}; add duplicateReason or reuse an existing key`,
    );
  }
}

for (const conceptId of Object.keys(concepts)) {
  const concept = concepts[conceptId];
  const used = Object.values(semanticKeys).some(
    (metadata) => isRecord(metadata) && metadata.conceptId === conceptId,
  );
  if (!used) errors.push(`semantic concept has no translation key: ${conceptId}`);
  if (!isRecord(concept)) continue;

  const canonicalKey = concept.canonicalKey;
  const canonicalMetadata = semanticKeys[canonicalKey];
  if (
    !isRecord(canonicalMetadata)
    || canonicalMetadata.conceptId !== conceptId
    || canonicalMetadata.reusePolicy !== "canonical"
  ) {
    errors.push(
      `${conceptId} canonicalKey must reference its canonical semantic key: ${canonicalKey}`,
    );
  }
  if (canonicalConcepts.get(conceptId) !== canonicalKey) {
    errors.push(`${conceptId} must have exactly one canonical key: ${canonicalKey}`);
  }
}

const legacyKeys = Array.isArray(baseline.keys) ? baseline.keys : [];
if (baseline.schemaVersion !== 1) {
  errors.push("legacy baseline schemaVersion must be 1");
}
if (new Set(legacyKeys).size !== legacyKeys.length) {
  errors.push("legacy baseline contains duplicate keys");
}
if (JSON.stringify(legacyKeys) !== JSON.stringify([...legacyKeys].sort())) {
  errors.push("legacy baseline keys must be sorted");
}

const semanticKeySet = new Set(Object.keys(semanticKeys));
const legacyKeySet = new Set(legacyKeys);
if (hashValue(legacyKeys) !== frozenLegacyKeyHash) {
  errors.push(
    "legacy key inventory changed; restore it and record new or migrated keys in the semantic catalog",
  );
}
for (const key of currentKeys) {
  const isSemantic = semanticKeySet.has(key);
  const isLegacy = legacyKeySet.has(key);
  if (!isSemantic && !isLegacy) {
    errors.push(`${key} has no semantic record and is not a frozen legacy key`);
  }
}

const activeLegacyKeys = legacyKeys.filter(
  (key) => referenceMap.has(key) && !semanticKeySet.has(key),
);
const calculatedHash = legacyHash(activeLegacyKeys, locales, localeMaps);
if (process.argv.includes("--print-legacy-hash")) {
  process.stdout.write(`${calculatedHash}\n`);
}
if (baseline.hash !== calculatedHash) {
  errors.push(
    `legacy translations changed; migrate touched keys to the semantic catalog and set the remaining legacy hash to ${calculatedHash}`,
  );
}

if (errors.length > 0) {
  process.stderr.write(
    `i18n check failed:\n${errors.map((error) => `- ${error}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `i18n check passed: ${currentKeys.length} keys, ${Object.keys(semanticKeys).length} semantic, ${activeLegacyKeys.length} active legacy\n`,
  );
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function mergeUniqueEntries(target, entries, kind, source, errorList) {
  if (!isRecord(entries)) return;
  for (const [name, value] of Object.entries(entries)) {
    if (name in target) {
      errorList.push(
        `semantic ${kind} appears in multiple shards; duplicate found in ${source}: ${name}`,
      );
    } else {
      target[name] = value;
    }
  }
}

function flattenStrings(value, prefix = "", output = new Map()) {
  if (!isRecord(value)) {
    throw new Error(`Locale resource ${prefix || "/"} must be an object`);
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      output.set(path, child);
    } else if (isRecord(child)) {
      flattenStrings(child, path, output);
    } else {
      throw new Error(`Locale value ${path} must be a string or object`);
    }
  }
  return output;
}

function placeholders(value = "") {
  return [
    ...new Set(
      [...value.matchAll(/{{\s*([^,{}\s]+)(?:\s*,[^{}]+)?\s*}}/g)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
}

function legacyHash(keys, orderedLocales, maps) {
  const payload = keys.map((key) => [
    key,
    ...orderedLocales.map((locale) => maps.get(locale)?.get(key)),
  ]);
  return hashValue(payload);
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
