// Local development only. Child processes and caches stay scoped to this checkout.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), children = new Set();
const webPort = process.env.WEB_PORT || "3102", apiPort = process.env.PORT || "8080", aiPort = process.env.AI_PORT || "8090";
const temporary = process.argv.includes("--memory");
const cache = resolve(root, ".cache"); mkdirSync(cache, { recursive: true });
const go = process.env.GO_BIN || (process.platform === "win32" && existsSync("C:/Program Files/Go/bin/go.exe") ? "C:/Program Files/Go/bin/go.exe" : "go");
const localPython = resolve(root, ".cache/ai-env", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.PYTHON_BIN || (existsSync(localPython) ? localPython : "python");
const env = { ...process.env, PORT: apiPort, GOCACHE: resolve(cache, "go-build"), DATABASE_URL: temporary ? "" : process.env.DATABASE_URL || "postgres://loccao:loccao@127.0.0.1:5432/loccao_english?sslmode=disable", REDIS_URL: temporary ? "" : process.env.REDIS_URL || "redis://127.0.0.1:6379", JWT_SECRET: process.env.JWT_SECRET || "local-development-only-change-before-deploying", ALLOW_ANONYMOUS_DEMO: process.env.ALLOW_ANONYMOUS_DEMO || "true", AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`, CORS_ORIGINS: process.env.CORS_ORIGINS || `http://localhost:${webPort},http://127.0.0.1:${webPort}`, NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || `http://localhost:${apiPort}` };
let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
  process.exitCode = code;
}
function launch(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit", windowsHide: true }); children.add(child);
  child.on("error", error => { console.error(`${label}: ${error.message}`); stop(1); });
  child.on("exit", code => { children.delete(child); if (!stopping && code !== 0) { console.error(`${label} stopped (${code}).`); stop(1); } });
  return child;
}
async function waitFor(url) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && !stopping) {
    try { const result = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (result.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Service did not become ready: ${url}`);
}
process.on("SIGINT", () => stop()); process.on("SIGTERM", () => stop());
try {
  // Unique output avoids replacing an executable still used by a different run.
  const binary = resolve(cache, `api-${randomBytes(4).toString("hex")}${process.platform === "win32" ? ".exe" : ""}`);
  const compiler = launch("Go build", go, ["build", "-o", binary, "./cmd/api"], resolve(root, "backend"));
  await new Promise((resolve, reject) => { compiler.once("error", reject); compiler.once("exit", code => code === 0 ? resolve() : reject(new Error("Backend compilation failed."))); });
  if (stopping) process.exit(1);
  launch("AI service", python, ["-m", "uvicorn", "app.server:app", "--host", "127.0.0.1", "--port", aiPort], resolve(root, "ai-service"));
  launch("API", binary, [], root);
  await Promise.all([waitFor(`http://127.0.0.1:${apiPort}/health`), waitFor(`http://127.0.0.1:${aiPort}/health`)]);
  if (!process.argv.includes("--services-only")) launch("Web", process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", webPort], root);
  console.log(`\nSunlit Village: http://localhost:${webPort}/journey`);
  console.log(temporary ? "Temporary memory mode: account data is lost when this process exits." : "Account data is stored in PostgreSQL. Ctrl+C stops this stack without deleting its data.");
} catch (error) { console.error(error.message); stop(1); }
