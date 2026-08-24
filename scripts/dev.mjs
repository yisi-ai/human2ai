import { spawn } from "node:child_process";
import process from "node:process";

const port = process.env.HUMAN2AI_PORT ?? "4179";
const serviceUrl =
  process.env.HUMAN2AI_SERVER_URL ?? `http://127.0.0.1:${port}`;
const children = [];

if (!(await isHuman2AiRunning(serviceUrl))) {
  children.push(runNpmScript("server:dev"));
}
children.push(runNpmScript("dev:web"));

let stopping = false;

function runNpmScript(script) {
  return spawn("npm", ["run", script], {
    env: process.env,
    stdio: "inherit",
  });
}

async function isHuman2AiRunning(baseUrl) {
  try {
    const response = await fetch(new URL("/api/v1/health", baseUrl), {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.service === "human2ai" && payload?.status === "ok";
  } catch {
    return false;
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
