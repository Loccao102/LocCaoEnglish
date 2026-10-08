import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import bank from "../../backend/internal/learning/dictation_catalog.json";

const API = process.env.E2E_API_URL || "http://localhost:8080";
const issued = (page:Page) => page.waitForResponse(r => r.url().endsWith("/v1/learning/attempts") && r.request().method() === "POST");
const card = (page:Page) => page.getByRole("region", { name:"Dictation practice" });
const field = (page:Page) => card(page).getByRole("textbox");
const check = (page:Page) => card(page).getByRole("button", { name:"Check answer", exact:true });
const sentence = (a:LearningAttempt) => bank.items.find(i => i.id === a.itemKey)!.transcript;

// Only speech events are simulated for headless CI; all attempt/audio/grade APIs are real.
test.beforeEach(async({page}) => {
  await page.addInitScript(() => {
    const state = { mode:"complete", cancelled:0, calls:0, current:null as SpeechSynthesisUtterance|null };
    Object.assign(window, { dictationSpeech:state });
    Object.defineProperty(window, "speechSynthesis", { configurable:true, value:{
      speak(u:SpeechSynthesisUtterance) { state.calls++;state.current=u;u.onstart?.({} as SpeechSynthesisEvent);if(state.mode!=="hold")setTimeout(()=>{if(state.mode==="fail")u.onerror?.({} as SpeechSynthesisErrorEvent);else u.onend?.({} as SpeechSynthesisEvent);},40); },
      cancel() { state.cancelled++; }
    }});
  });
});

test("Dictation saves drafts, aligns extra words and locks feedback after a lost answer", async({page}) => {
  const opened=issued(page);await page.goto("/dictation");const a:LearningAttempt=await(await opened).json();
  expect(a.prompt).not.toHaveProperty("transcript");expect(a).not.toHaveProperty("correctAnswer");
  const answer=sentence(a)+" extra";
  await field(page).fill(answer);await expect(check(page)).toBeDisabled();await page.reload();await expect(field(page)).toHaveValue(answer);
  await page.evaluate(()=>{(window as any).dictationSpeech.mode="fail";});
  await card(page).getByRole("button",{name:"Play audio",exact:true}).click();await expect(card(page).getByText(/0 completed.*1 failed/)).toBeVisible();await expect(check(page)).toBeDisabled();
  await page.evaluate(()=>{(window as any).dictationSpeech.mode="complete";});
  await card(page).getByRole("button",{name:"Listen slowly · 0.72×"}).click();await expect(check(page)).toBeEnabled();
  let payload:unknown;
  await page.route("**/v1/learning/attempts/*/submit",async route=>{payload=route.request().postDataJSON();await route.abort("failed");},{times:1});
  await check(page).click();await expect(page.getByRole("button",{name:"Retry same answer"})).toBeVisible();await expect(field(page)).toHaveAttribute("readonly","");await page.reload();
  await expect(field(page)).toHaveValue(answer);const retry=page.waitForRequest(r=>r.url().endsWith(`/${a.attemptId}/submit`));
  await page.getByRole("button",{name:"Retry same answer"}).click();expect((await retry).postDataJSON()).toEqual(payload);
  await expect(card(page).getByText("Compare your sentence",{exact:true})).toBeVisible();
  await expect(card(page).getByText(/0 missing · 1 extra · 0 replaced/)).toBeVisible();await expect(card(page).getByRole("list",{name:"Word comparison"}).locator('[data-kind="extra"]')).toHaveText("Extra extra");
  await page.reload();await expect(field(page)).toHaveValue(answer);await expect(field(page)).toHaveAttribute("readonly","");await expect(card(page).getByText(/1 completed · 0 replays · 1 slow listens · 1 failed/)).toBeVisible();
});

test("Dictation account grade survives committed response loss and draft owners stay separate",async({page,request})=>{
  const registered=await request.post(`${API}/v1/auth/register`,{data:{email:`dictation-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:"Writer"}});expect(registered.ok()).toBe(true);const user=await registered.json();
  await page.goto("/account");await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},user.token);
  let opened=issued(page);await page.goto("/dictation");const a:LearningAttempt=await(await opened).json();
  await field(page).fill(sentence(a));await card(page).getByRole("button",{name:"Play audio",exact:true}).click();await expect(check(page)).toBeEnabled();
  await page.route("**/v1/learning/attempts/*/submit",async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort("failed");},{times:1});
  await check(page).click();await expect(page.getByRole("button",{name:"Retry same answer"})).toBeVisible();await page.reload();await expect(card(page).getByText("✓ Perfect dictation",{exact:true})).toBeVisible();await expect(page.getByText("+20 XP · Progress saved.",{exact:true})).toBeVisible();
  const headers={Authorization:`Bearer ${user.token}`};const data={answer:sentence(a),contentVersion:a.contentVersion,rulesVersion:a.rulesVersion};
  expect((await request.post(`${API}/v1/learning/attempts/${a.attemptId}/submit`,{headers,data})).ok()).toBe(true);
  expect((await(await request.get(`${API}/v1/me`,{headers})).json()).user.xp).toBe(20);
  expect((await request.post(`${API}/v1/learning/attempts/${a.attemptId}/submit`,{headers,data:{...data,answer:data.answer+" changed"}})).status()).toBe(409);
  expect((await request.get(`${API}/v1/learning/attempts/${a.attemptId}`)).status()).toBe(404);
  expect((await request.post(`${API}/v1/attempts`,{headers,data:{activity:" DICTATION ",skill:"Dictation",itemKey:"fake",accuracy:1}})).status()).toBe(409);
  opened=issued(page);await card(page).getByRole("button",{name:"Next sentence →"}).click();await opened;await field(page).fill("My private draft");
  await page.evaluate(()=>{(window as any).dictationSpeech.mode="hold";});await card(page).getByRole("button",{name:"Play audio",exact:true}).click();await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();
  await page.evaluate(()=>{localStorage.removeItem("loccao_token");window.dispatchEvent(new Event("loccao-auth-change"));});await expect(card(page).getByText("Guest practice",{exact:true})).toBeVisible();await expect(field(page)).toHaveValue("");expect(await page.evaluate(()=>(window as any).dictationSpeech.cancelled)).toBeGreaterThan(0);
  await field(page).fill("Guest draft");await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},user.token);await expect(field(page)).toHaveValue("My private draft");
});

test("Dictation difficulty persists and a set offers three distinct sentences",async({page})=>{
  await page.goto("/dictation");await expect(card(page).getByRole("combobox")).toBeEnabled();let opened=issued(page);await card(page).getByRole("combobox").selectOption("B2");let a:LearningAttempt=await(await opened).json();await page.reload();await expect(card(page).getByRole("combobox")).toHaveValue("B2");
  const seen=new Set<string>();
  for(let i=0;i<3;i++){
    expect(a.cefrLevel).toBe("B2");expect(seen.has(a.itemKey)).toBe(false);seen.add(a.itemKey);
    await field(page).fill(sentence(a));await card(page).getByRole("button",{name:"Play audio",exact:true}).click();await expect(check(page)).toBeEnabled();await check(page).click();await expect(card(page).getByText("100% word accuracy",{exact:true})).toBeVisible();
    opened=issued(page);await card(page).getByRole("button",{name:i===2?"Play another set":"Next sentence →"}).click();a=await(await opened).json();
  }
  await expect(card(page).getByText("Round 1/3",{exact:true})).toBeVisible();await expect(field(page)).toHaveValue("");
});

for(const height of [551,844])test(`Dictation keyboard and feedback remain readable at 390x${height}`,async({page},info)=>{
  await page.setViewportSize({width:390,height});const opened=issued(page);await page.goto("/dictation");const a:LearningAttempt=await(await opened).json();
  const play=card(page).getByRole("button",{name:"Play audio",exact:true});await play.focus();await page.keyboard.press("Enter");await field(page).fill(sentence(a).split(" ").slice(1).join(" "));await expect(check(page)).toBeEnabled();
  expect(await field(page).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  for(const button of await card(page).getByRole("button").all()){expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);}
  await check(page).focus();await page.keyboard.press("Enter");await expect(card(page).getByText(/1 missing · 0 extra · 0 replaced/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath("dictation-mobile.png"),fullPage:true});
});
