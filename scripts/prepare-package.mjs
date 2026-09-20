import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(readFileSync(join(root, ".yisiui/config.json"), "utf8"));
mkdirSync(join(root, "licenses"), { recursive: true });
copyFileSync(
  join(root, config.vendorRoot, "LICENSE"),
  join(root, "licenses/YisiUI-LICENSE"),
);

// Browser bundles contain dependency code, so ship its original notices too.
const notices = new Map();
const visited = new Set();
function collect(name, from) {
  let parent = from;
  while (!existsSync(join(parent, "node_modules", name, "package.json"))) {
    const next = dirname(parent);
    if (next === parent) throw new Error(`Cannot locate dependency license: ${name}`);
    parent = next;
  }
  const directory = realpathSync(join(parent, "node_modules", name));
  if (visited.has(directory)) return;
  visited.add(directory);
  const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  if (!pkg.private) {
    const files = readdirSync(directory).filter((file) => /^(licen[cs]e|copying|notice)(?:[.-]|$)/i.test(file));
    // Some packages publish their original license notice only in the README.
    if (files.length === 0) {
      files.push(...readdirSync(directory).filter((file) => /^readme(?:\.|$)/i.test(file)));
    }
    notices.set(`${pkg.name}@${pkg.version}`, [
      `${pkg.name}@${pkg.version} (${pkg.license ?? "see original notices"})`,
      ...files.sort().map((file) => `${file}\n${readFileSync(join(directory, file), "utf8")}`),
    ].join("\n\n"));
    if (pkg.name === "next") collectEmbedded(join(directory, "dist/compiled"), "next/dist/compiled");
  }
  for (const dependency of Object.keys(pkg.dependencies ?? {})) collect(dependency, directory);
}

function collectEmbedded(directory, label) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectEmbedded(path, `${label}/${entry.name}`);
    else if (/^(licen[cs]e|copying|notice)(?:[.-]|$)/i.test(entry.name)) {
      notices.set(`${label}/${entry.name}`, `${label}/${entry.name}\n\n${readFileSync(path, "utf8")}`);
    }
  }
}

for (const directory of [root, join(root, "web")]) {
  const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  for (const name of Object.keys(pkg.dependencies)) collect(name, directory);
}
writeFileSync(join(root, "licenses/THIRD-PARTY-NOTICES.txt"), [
  "Original notices for dependencies used by Human2AI and its browser bundle.",
  "Each dependency retains its own license; Human2AI's MIT license does not replace it.",
  ...[...notices.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([, text]) => text),
].join("\n\n-----\n\n") + "\n");
