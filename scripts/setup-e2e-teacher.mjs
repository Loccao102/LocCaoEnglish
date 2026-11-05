import { execFileSync } from "node:child_process";

// This helper is exclusively for the fresh, disposable GitHub Actions stack.
// Public registration never grants teacher privileges.
try {
  const endpoint = new URL(process.env.E2E_API_URL || "http://127.0.0.1:8080");
  const email = process.env.E2E_TEACHER_EMAIL || "e2e-analytics-teacher@example.test";
  if (process.env.GITHUB_ACTIONS !== "true" || endpoint.origin !== "http://127.0.0.1:8080" || endpoint.pathname !== "/" || endpoint.search || endpoint.hash || endpoint.username || endpoint.password || !/^[a-z0-9-]+@example\.test$/.test(email)) {
    throw new Error("fixture requires the disposable CI stack");
  }
  const response = await fetch(new URL("/v1/auth/register", endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SunlitTest123!", displayName: "CI analytics teacher" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 201) throw new Error("dedicated fixture registration failed");
  const account = await response.json();
  if (typeof account.user?.id !== "string" || !/^[a-f0-9]{32}$/.test(account.user.id)) throw new Error("invalid fixture account ID");
  execFileSync("docker", ["compose", "exec", "-T", "api", "/roles", "--user-id", account.user.id, "--role", "teacher"], { stdio: "pipe", timeout: 90_000 });
  const me = await fetch(new URL("/v1/me", endpoint), { headers: { Authorization: `Bearer ${account.token}` }, signal: AbortSignal.timeout(30_000) });
  if (!me.ok || (await me.json()).role !== "teacher") throw new Error("operator fixture role was not confirmed");
  console.log("Dedicated CI teacher fixture prepared by account ID.");
} catch {
  // No tokens, passwords, database URLs or subprocess argument dumps in logs.
  console.error("Dedicated CI teacher setup failed; inspect the isolated stack and operator command.");
  process.exitCode = 1;
}
