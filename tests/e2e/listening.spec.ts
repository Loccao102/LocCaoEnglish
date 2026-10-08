import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import type { LearningAttempt } from "../../lib/learning-attempt";
import bank from "../../backend/internal/learning/listening_catalog.json";

const issued=(page:Page)=>page.waitForResponse(r=>r.url().endsWith("/v1/learning/attempts")&&r.request().method()==="POST");
const card=(page:Page)=>page.getByRole("region",{name:"Listening practice"});
const item=(a:LearningAttempt)=>bank.items.find(i=>i.id===a.itemKey)!;
const API=process.env.E2E_API_URL||"http://localhost:8080";

// Headless CI has no installed speech voice. Only media events are simulated;
// attempts, snapshots, audio requests/reports, grades and rewards use the real API.
async function speechDriver(page:Page){
 await page.addInitScript(()=>{
  const state={mode:"complete",calls:0,cancelled:0,current:null as SpeechSynthesisUtterance|null};
  Object.assign(window,{testSpeech:state});
  Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{
   speak(u:SpeechSynthesisUtterance){state.calls++;state.current=u;u.onstart?.({} as SpeechSynthesisEvent);if(state.mode!=="hold")setTimeout(()=>{if(state.mode==="fail")u.onerror?.({} as SpeechSynthesisErrorEvent);else u.onend?.({} as SpeechSynthesisEvent);},40);},
   cancel(){state.cancelled++;},
  }});
 });
}
test.beforeEach(async({page})=>speechDriver(page));

test("Listening waits for audio completion, retains slow replay and restores a lost report",async({page},info)=>{
 let opened=issued(page);await page.goto("/listening?pack=travel-airport");let a:LearningAttempt=await(await opened).json();
 expect(a.prompt).not.toHaveProperty("transcript");expect(a.listening?.events).toEqual([]);
 await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(0);
 await page.evaluate(()=>{(window as any).testSpeech.mode="hold";});
 await card(page).getByRole("button",{name:"Play audio",exact:true}).click();
 await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();
 await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(0);
 await page.route("**/v1/learning/attempts/*/audio",async route=>{
  if(route.request().postDataJSON().status==="completed"){const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort("failed");}else await route.continue();
 });
 await page.evaluate(()=>{const s=(window as any).testSpeech;s.current.onend({});});
 await expect(card(page).getByRole("button",{name:"Retry audio request"})).toBeVisible();
 await page.unroute("**/v1/learning/attempts/*/audio");await page.reload();
 await expect(card(page).getByText(/1 completed · 0 replays · 0 slow listens/)).toBeVisible();
 await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(4);
 await card(page).getByRole("button",{name:"Listen slowly · 0.72×"}).click();
 await expect(card(page).getByText(/2 completed · 1 replays · 1 slow listens/)).toBeVisible();
 await page.screenshot({path:info.outputPath("listening-desktop.png"),fullPage:true});
 const seen=new Set<string>();
 for(let i=0;i<3;i++){
  expect(seen.has(a.itemKey)).toBe(false);seen.add(a.itemKey);
  if(i>0){await card(page).getByRole("button",{name:"Play audio",exact:true}).click();await expect(card(page).getByRole("button",{name:item(a).correctAnswer,exact:true})).toBeEnabled();}
  await card(page).getByRole("button",{name:item(a).correctAnswer,exact:true}).click();
  await expect(card(page).getByText("✓ Detail understood",{exact:true})).toBeVisible();
  await expect(card(page).locator("blockquote")).toHaveText(item(a).transcript);
  opened=issued(page);await card(page).getByRole("button",{name:i===2?"Play another set":"Next clip →"}).click();a=await(await opened).json();
 }
 expect(a.listening?.events).toEqual([]);
});

test("Audio failure stays locked; an uncommitted completion report retries after reload without replay",async({page})=>{
 const opened=issued(page);await page.goto("/listening");const a:LearningAttempt=await(await opened).json();
 await page.evaluate(()=>{(window as any).testSpeech.mode="fail";});
 await card(page).getByRole("button",{name:"Play audio",exact:true}).click();
 await expect(card(page).getByText(/0 completed · 0 replays · 0 slow listens · 1 failed/)).toBeVisible();
 await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(0);
 await page.evaluate(()=>{(window as any).testSpeech.mode="complete";});
 let pending:unknown;
 await page.route("**/v1/learning/attempts/*/audio",async route=>{
  if(route.request().postDataJSON().status==="completed"){pending=route.request().postDataJSON();await route.abort("failed");}else await route.continue();
 });
 await card(page).getByRole("button",{name:"Play audio",exact:true}).click();
 await expect(card(page).getByRole("button",{name:"Retry audio request"})).toBeVisible();
 await page.unroute("**/v1/learning/attempts/*/audio");await page.reload();
 const retry=page.waitForRequest(r=>r.url().endsWith(`/${a.attemptId}/audio`));
 await card(page).getByRole("button",{name:"Retry audio request"}).click();expect((await retry).postDataJSON()).toEqual(pending);
 await expect(card(page).getByText(/1 completed · 0 replays · 0 slow listens · 1 failed/)).toBeVisible();
 expect(await page.evaluate(()=>(window as any).testSpeech.calls)).toBe(0);
 let answerPayload:unknown;
 await page.route("**/v1/learning/attempts/*/submit",async route=>{answerPayload=route.request().postDataJSON();await route.abort("failed");},{times:1});
 const wrong=a.prompt.options.find(o=>o!==item(a).correctAnswer)!;
 await card(page).getByRole("button",{name:wrong,exact:true}).click();await expect(page.getByRole("button",{name:"Retry same answer"})).toBeVisible();await page.reload();
 await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(0);
 const retried=page.waitForRequest(r=>r.url().endsWith(`/${a.attemptId}/submit`));await page.getByRole("button",{name:"Retry same answer"}).click();expect((await retried).postDataJSON()).toEqual(answerPayload);
 await expect(card(page).getByText("Listen for this detail",{exact:true})).toBeVisible();
 await page.reload();await expect(card(page).getByText(`Your choice: ${wrong}`,{exact:true})).toBeVisible();
});

test("Listening account result survives lost submit response and switching accounts cancels audio",async({page,request})=>{
 const registered=await request.post(`${API}/v1/auth/register`,{data:{email:`listen-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:"Listener"}});expect(registered.ok()).toBe(true);const user=await registered.json();
 await page.goto("/account");await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},user.token);
 let opened=issued(page);await page.goto("/listening");const a:LearningAttempt=await(await opened).json();
 await card(page).getByRole("button",{name:"Play audio",exact:true}).click();await expect(card(page).getByRole("button",{name:item(a).correctAnswer,exact:true})).toBeEnabled();
 let payload:unknown;
 await page.route("**/v1/learning/attempts/*/submit",async route=>{payload=route.request().postDataJSON();const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort("failed");},{times:1});
 await card(page).getByRole("button",{name:item(a).correctAnswer,exact:true}).click();await expect(page.getByRole("button",{name:"Retry same answer"})).toBeVisible();await page.reload();
 await expect(page.getByText("+20 XP · Progress saved.",{exact:true})).toBeVisible();
 const headers={Authorization:`Bearer ${user.token}`};const retry=await request.post(`${API}/v1/learning/attempts/${a.attemptId}/submit`,{headers,data:payload});expect((await retry.json()).xpDelta).toBe(20);expect((await(await request.get(`${API}/v1/me`,{headers})).json()).user.xp).toBe(20);
 opened=issued(page);await card(page).getByRole("button",{name:"Next clip →"}).click();await opened;
 await page.evaluate(()=>{(window as any).testSpeech.mode="hold";});await card(page).getByRole("button",{name:"Play audio",exact:true}).click();await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();
 await page.evaluate(()=>{localStorage.removeItem("loccao_token");window.dispatchEvent(new Event("loccao-auth-change"));});
 await expect(card(page).getByText("Guest practice",{exact:true})).toBeVisible();await expect(card(page).getByText(/0 completed/)).toBeVisible();expect(await page.evaluate(()=>(window as any).testSpeech.cancelled)).toBeGreaterThan(0);
 expect((await request.get(`${API}/v1/learning/attempts/${a.attemptId}`)).status()).toBe(404);
});

test("A result committed in another tab is restored while retrying a completed audio report",async({page,request})=>{
 const opened=issued(page);await page.goto("/listening");const a:LearningAttempt=await(await opened).json();
 await page.route("**/v1/learning/attempts/*/audio",async route=>{
  if(route.request().postDataJSON().status==="completed"){const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort("failed");}else await route.continue();
 });
 await card(page).getByRole("button",{name:"Play audio",exact:true}).click();
 await expect(card(page).getByRole("button",{name:"Retry audio request"})).toBeVisible();
 const committed=await request.post(`${API}/v1/learning/attempts/${a.attemptId}/submit`,{data:{answer:item(a).correctAnswer,contentVersion:a.contentVersion,rulesVersion:a.rulesVersion}});expect(committed.ok()).toBe(true);
 await page.unroute("**/v1/learning/attempts/*/audio");
 await card(page).getByRole("button",{name:"Retry audio request"}).click();
 await expect(card(page).getByText("✓ Detail understood",{exact:true})).toBeVisible();
 await expect(card(page).getByRole("button",{name:"Next clip →"})).toBeVisible();
});

test("Neural media rejection never counts as played and a later completed clip records its provider",async({page})=>{
 await page.addInitScript(()=>{
  Object.assign(window,{testMediaReject:true});
  class MediaDriver {
   onplaying:(()=>void)|null=null;onended:(()=>void)|null=null;onerror:(()=>void)|null=null;
   play(){if((window as any).testMediaReject)return Promise.reject(new Error("blocked"));setTimeout(()=>{this.onplaying?.();this.onended?.();},30);return Promise.resolve();}
   pause(){} removeAttribute(){}
  }
  Object.defineProperty(window,"Audio",{configurable:true,value:MediaDriver});
 });
 await page.route("**/v1/learning/attempts/*/audio",async route=>{
  const response=await route.fetch();const data=await response.json();
  if(data.audio)data.audio={provider:"azure-speech-neural-tts",rate:route.request().postDataJSON().rate,mimeType:"audio/mpeg",audioBase64:"dGVzdA=="};
  await route.fulfill({response,json:data});
 });
 const opened=issued(page);await page.goto("/listening");const a:LearningAttempt=await(await opened).json();
 await card(page).getByRole("button",{name:"Play audio",exact:true}).click();
 await expect(card(page).getByText(/0 completed · 0 replays · 0 slow listens · 1 failed/)).toBeVisible();
 await expect(card(page).getByRole("group").locator("button:enabled")).toHaveCount(0);
 await page.evaluate(()=>{(window as any).testMediaReject=false;});
 await card(page).getByRole("button",{name:"Play audio",exact:true}).click();
 await expect(card(page).getByRole("button",{name:item(a).correctAnswer,exact:true})).toBeEnabled();
 const submitted=page.waitForResponse(r=>r.url().endsWith(`/${a.attemptId}/submit`));
 await card(page).getByRole("button",{name:item(a).correctAnswer,exact:true}).click();
 expect((await(await submitted).json()).listening.events).toMatchObject([{status:"failed",provider:"azure-speech-neural-tts"},{status:"completed",provider:"azure-speech-neural-tts"}]);
});

for(const height of [551,844])test(`Listening is readable and keyboard playable at 390x${height}`,async({page},info)=>{
 await page.setViewportSize({width:390,height});const opened=issued(page);await page.goto("/listening?pack=conversation-plans");const a:LearningAttempt=await(await opened).json();
 const play=card(page).getByRole("button",{name:"Play audio",exact:true});await play.focus();await page.keyboard.press("Enter");const choice=card(page).getByRole("button",{name:item(a).correctAnswer,exact:true});await expect(choice).toBeEnabled();
 for(const button of await card(page).getByRole("group").getByRole("button").all()){expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(await button.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:info.outputPath("listening-mobile.png"),fullPage:true});await choice.focus();await page.keyboard.press("Enter");await expect(card(page).getByText("✓ Detail understood",{exact:true})).toBeVisible();
});
