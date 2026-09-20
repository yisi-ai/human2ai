import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

process.env.HUMAN2AI_PORT ??= "4180";
process.env.HUMAN2AI_DATABASE_PATH ??= fileURLToPath(
  new URL("../.human2ai-data/human2ai.sqlite", import.meta.url),
);
const port = process.env.HUMAN2AI_PORT;
const serviceUrl =
  process.env.HUMAN2AI_SERVER_URL ?? `http://127.0.0.1:${port}`;
const children = [];
const serviceStatus = await inspectHuman2AiService(serviceUrl);

if (serviceStatus === "incompatible") {
  process.stderr.write(
    `The Human2AI service at ${serviceUrl} does not support UI sketch drafts. Stop the old service and run npm run dev again.\n`,
  );
  process.exit(1);
}
if (serviceStatus === "unavailable") {
  children.push(runNpmScript("server:dev"));
}
children.push(runNpmScript("dev:web"));
children.push(runNpmScript("build:server:watch"));

let stopping = false;

function runNpmScript(script) {
  return spawn("npm", ["run", script], {
    env: process.env,
    stdio: "inherit",
  });
}

async function inspectHuman2AiService(baseUrl) {
  try {
    const response = await fetch(new URL("/api/v1/health", baseUrl), {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return "unavailable";
    const payload = await response.json();
    if (payload?.service !== "human2ai" || payload?.status !== "ok") {
      return "unavailable";
    }
    return Array.isArray(payload.capabilities)
      && payload.capabilities.includes("ui-sketch-drafts")
      ? "compatible"
      : "incompatible";
  } catch {
    return "unavailable";
  }
}

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => stop(signal));
}

await Promise.race(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.once("exit", (code, signal) => resolve({ code, signal }));
      }),
  ),
).then(({ code, signal }) => {
  stop();
  if (code && code !== 0) process.exitCode = code;
  if (signal && signal !== "SIGINT" && signal !== "SIGTERM") process.exitCode = 1;
});
