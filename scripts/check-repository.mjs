import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter(Boolean);
const forbidden = files.filter((file) => (
  /^(docs|artifacts|output|\.human2ai-data)\//.test(file)
  || /\.(sqlite|db)(?:-|$)|\.tgz$/.test(file)
  || /(^|\/)\.env(?:$|\.)/.test(file) && !file.endsWith(".env.example")
));
if (forbidden.length > 0) {
  throw new Error(`Private documents or runtime data are tracked by Git:\n${forbidden.join("\n")}`);
}
process.stdout.write("Repository distribution boundaries passed.\n");
