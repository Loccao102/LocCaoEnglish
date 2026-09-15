import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:8080";

test("account courses enforce unlocks and retain replay badges with idempotent retries", async ({ request }) => {
  const account = await request.post(`${API}/v1/auth/register`, {
    data: { email: `sky-atlas-${randomUUID()}@example.test`, password: "SunlitTest123!", displayName: "Sky Explorer" },
  });
  expect(account.ok(), await account.text()).toBe(true);
  const { token } = await account.json();
  const headers = { Authorization: `Bearer ${token}` };
  const first = { runId: randomUUID(), gameId: "cloud-hop", courseId: "cloud-01", stars: 3, elapsedMs: 45000, feathers: 0 };
  const second = { ...first, runId: randomUUID(), courseId: "cloud-02" };
  const post = (data: typeof first) => request.post(`${API}/v1/fair/completions`, { headers, data });
  expect((await post(second)).status()).toBe(409);
  const repeated = await Promise.all(Array.from({ length: 6 }, () => post(first)));
  for (const response of repeated) {
    expect(response.ok(), await response.text()).toBe(true);
    expect((await response.json()).save.courses["cloud-01"]).toEqual({ medals: 2, clean: true, feathers: 0, bestMs: 45000, visits: 1 });
  }
  expect((await post({ ...first, feathers: 3 })).status()).toBe(409);
  const explored = await post({ ...first, runId: randomUUID(), stars: 1, feathers: 3, elapsedMs: 60000 });
  expect(explored.ok(), await explored.text()).toBe(true);
  expect((await explored.json()).save.courses["cloud-01"]).toEqual({ medals: 3, clean: true, feathers: 3, bestMs: 45000, visits: 2 });
  expect((await post(second)).ok()).toBe(true);
  expect((await post({ ...first, runId: randomUUID(), gameId: "tea-time" })).status()).toBe(400);
  const saved = await request.get(`${API}/v1/fair`, { headers });
  expect(saved.ok()).toBe(true);
  const { save } = await saved.json();
  expect(save.games["cloud-hop"].visits).toBe(3);
  expect(save.courses["cloud-01"].medals).toBe(3);
  expect(save.courses["cloud-02"].visits).toBe(1);
});
