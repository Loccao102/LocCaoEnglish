import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import catalog from "../../backend/internal/learning/ielts_listening_catalog.json";
import type { LearningAttempt, IELTSReadingPrompt } from "../../lib/learning-attempt";

const API=process.env.E2E_API_URL || "http://localhost:8080";
type Paper=LearningAttempt & {prompt:{listeningPaper:IELTSReadingPrompt}};
const card=(page:Page)=>page.getByRole("region",{name:"IELTS Listening practice",exact:true});
const group=(page:Page,n:number)=>card(page).getByRole("group",{name:new RegExp(`^${n}\\. `)});
const issued=(page:Page)=>page.waitForResponse(r=>r.url().endsWith("/v1/learning/attempts")&&r.request().method()==="POST");
const versions=(a:Paper)=>({contentVersion:a.contentVersion,rulesVersion:a.rulesVersion});
const path=(a:Paper)=>`${API}/v1/learning/attempts/${a.attemptId}`;
const questions=(a:Paper)=>a.prompt.listeningPaper.sections.flatMap(s=>s.questions);
const correct=(q:ReturnType<typeof questions>[number])=>q.options.find(o=>o.text===catalog.sections.flatMap(s=>s.questions).find(item=>item.id===q.id)!.answer)!;

// Real API/store and production rate limits. Suites use separate full windows;
// only browser media events are simulated because headless CI has no voice.
async function separateRateWindow(){test.setTimeout(90_000);await delay(60_100);}
test.beforeAll(separateRateWindow);test.afterAll(separateRateWindow);
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const state={mode:"complete",calls:0,cancelled:0,current:null as SpeechSynthesisUtterance|null,lateEnd:null as ((event:SpeechSynthesisEvent)=>void)|null};
    Object.assign(window,{ieltsSpeech:state});
    Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{
      speak(u:SpeechSynthesisUtterance){state.calls++;state.current=u;state.lateEnd=u.onend;u.onstart?.({} as SpeechSynthesisEvent);if(state.mode!=="hold")setTimeout(()=>{if(state.mode==="fail")u.onerror?.({} as SpeechSynthesisErrorEvent);else u.onend?.({} as SpeechSynthesisEvent);},30);},
      cancel(){state.cancelled++;},
    }});
  });
});
async function learner(request:APIRequestContext){
  const r=await request.post(`${API}/v1/auth/register`,{data:{email:`ielts-listening-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:"Listener"}});
  expect(r.ok(),await r.text()).toBe(true);const u=await r.json();return {...u,headers:{Authorization:`Bearer ${u.token}`}};
}
async function login(page:Page,token:string){
  await page.addInitScript(({token,key})=>{if(!sessionStorage.getItem(key)){localStorage.setItem("loccao_token",token);sessionStorage.setItem(key,"ready");}},{token,key:randomUUID()});
  const opened=issued(page);await page.goto("/ielts/listening");const a:Paper=await(await opened).json();await expect(group(page,1)).toBeVisible();return a;
}
async function playPart(page:Page,n:number){
  await card(page).getByRole("button",{name:`Part ${n}`,exact:true}).click();
  await card(page).getByRole("button",{name:"Play recording",exact:true}).click();
  await expect(card(page).getByRole("button",{name:`Part ${n}`,exact:true})).toContainText("Listened");
}
async function playAll(page:Page){for(let n=1;n<=4;n++)await playPart(page,n);await card(page).getByRole("button",{name:"Part 1",exact:true}).click();}
async function submitPartial(page:Page){await card(page).getByRole("button",{name:"Submit choices",exact:true}).click();await card(page).getByRole("button",{name:"Submit with unanswered questions",exact:true}).click();}
async function history(request:APIRequestContext,headers:Record<string,string>){const r=await request.get(`${API}/v1/ielts/history`,{headers});expect(r.ok()).toBe(true);return(await r.json()).items;}

test("Listening API grades actual selections only after all four part reports and freezes one evidence receipt",async({page,request})=>{
  await page.goto("/ielts/listening");await expect(page.getByRole("heading",{name:"Sign in to save your Listening practice"})).toBeVisible();
  const input={activity:"ielts-listening",pack:"ielts-listening",cefrLevel:"B2",requestId:randomUUID()};
  expect((await request.post(`${API}/v1/learning/attempts`,{data:input})).status()).toBe(401);
  const user=await learner(request),other=await learner(request);
  const r=await request.post(`${API}/v1/learning/attempts`,{headers:user.headers,data:input});expect(r.status()).toBe(201);const a:Paper=await r.json();
  expect(a.prompt.listeningPaper.sections).toHaveLength(4);expect(questions(a)).toHaveLength(40);
  expect(JSON.stringify(a)).not.toMatch(/correctOptions|correctOptionId|correctAnswer|"answer"|"transcript"|"transcripts"/);
  for(const part of a.prompt.listeningPaper.sections)expect(part).not.toHaveProperty("passage");
  expect(await(await request.post(`${API}/v1/learning/attempts`,{headers:user.headers,data:input})).json()).toEqual(a);
  const answer=JSON.stringify(questions(a).map(q=>[q.id,correct(q).id]));
  expect((await request.post(`${path(a)}/submit`,{headers:user.headers,data:{...versions(a),answer}})).status()).toBe(409);
  for(const invalid of ["{}","[[\"unknown\",\"unknown\"]]",JSON.stringify([[questions(a)[0].id,correct(questions(a)[1]).id]])])expect((await request.post(`${path(a)}/submit`,{headers:user.headers,data:{...versions(a),answer:invalid}})).status()).toBe(400);
  expect((await request.get(path(a),{headers:other.headers})).status()).toBe(404);
  for(let i=0;i<4;i++){
    const part=a.prompt.listeningPaper.sections[i],event={...versions(a),requestId:randomUUID(),partId:part.id,rate:1,status:"requested"};
    const prepared=await request.post(`${path(a)}/audio`,{headers:user.headers,data:event});expect(prepared.ok(),await prepared.text()).toBe(true);
    expect((await prepared.json()).attempt.listening).not.toHaveProperty("transcripts");
    expect((await request.post(`${path(a)}/audio`,{headers:user.headers,data:{...event,partId:a.prompt.listeningPaper.sections[(i+1)%4].id}})).status()).toBe(409);
    const report={...event,status:"completed",provider:"browser-speech-synthesis"};
    const done=await request.post(`${path(a)}/audio`,{headers:user.headers,data:report});expect(done.ok()).toBe(true);
    expect(await(await request.post(`${path(a)}/audio`,{headers:user.headers,data:report})).json()).toEqual(await done.json());
    if(i<3)expect((await request.post(`${path(a)}/submit`,{headers:user.headers,data:{...versions(a),answer}})).status()).toBe(409);
  }
  expect((await request.post(`${API}/v1/ielts/objective-score`,{headers:user.headers,data:{section:"listening",correct:40,total:40}})).status()).toBe(409);
  expect((await request.post(`${API}/v1/attempts`,{headers:user.headers,data:{skill:"Listening",activity:" IELTS-LISTENING-score ",itemKey:"test",accuracy:1}})).status()).toBe(409);
  const submitted=await request.post(`${path(a)}/submit`,{headers:user.headers,data:{...versions(a),answer}});expect(submitted.ok()).toBe(true);const result=await submitted.json();
  expect(result).toMatchObject({actualAnswer:answer,xpDelta:0,newConfidence:0,level:0,reviewAdded:false,progressionApplied:false,ielts:{section:"listening",rawScore:40,maxScore:40,band:9,methodVersion:"ielts-anchors-interpolation.v1"},listening:{source:"client-reported-playback"}});
  expect(result.ielts.answers.every((q:{correct:boolean})=>q.correct)).toBe(true);expect(Object.keys(result.listening.transcripts)).toHaveLength(4);
  expect(await(await request.post(`${path(a)}/submit`,{headers:user.headers,data:{...versions(a),answer}})).json()).toEqual(result);
  expect((await request.post(`${path(a)}/submit`,{headers:user.headers,data:{...versions(a),answer:"[]"}})).status()).toBe(409);
  expect((await request.post(`${path(a)}/audio`,{headers:user.headers,data:{...versions(a),requestId:randomUUID(),partId:a.prompt.listeningPaper.sections[0].id,rate:1,status:"requested"}})).status()).toBe(409);
  const saved=await history(request,user.headers);expect(saved).toHaveLength(1);expect(saved[0]).toMatchObject({attemptId:a.attemptId,section:"listening",legacy:false,evidence:"server-objective-practice",provider:"loccao-objective"});
  expect(await history(request,other.headers)).toEqual([]);expect((await(await request.get(`${API}/v1/me`,{headers:user.headers})).json()).user.xp).toBe(0);
});

test("Listening retains failed, hidden and long playback; lost and uncommitted audio reports recover without extra playback",async({page,request})=>{
  await page.clock.install();const user=await learner(request),a=await login(page,user.token);
  expect(await page.content()).not.toContain(catalog.sections[0].transcript);
  const option=correct(questions(a)[0]);await group(page,1).getByRole("radio",{name:option.text,exact:true}).check();
  await expect(card(page).getByRole("button",{name:"Submit choices",exact:true})).toBeDisabled();
  await page.evaluate(()=>{(window as any).ieltsSpeech.mode="fail";});
  await card(page).getByRole("button",{name:"Play recording",exact:true}).click();await expect(card(page).getByText(/0 completed · 0 replays · 0 slow listens · 1 failed/)).toBeVisible();
  await page.evaluate(()=>{(window as any).ieltsSpeech.mode="hold";});
  await card(page).getByRole("button",{name:"Play recording",exact:true}).click();await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  await expect(card(page).getByText(/0 completed · 0 replays · 0 slow listens · 2 failed/)).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
  await card(page).getByRole("button",{name:"Play recording",exact:true}).click();await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();
  await page.route("**/v1/learning/attempts/*/audio",async route=>{if(route.request().postDataJSON().status==="completed"){const r=await route.fetch();expect(r.ok()).toBe(true);await route.abort("failed");}else await route.continue();});
  await page.evaluate(()=>{(window as any).ieltsSpeech.current.onend({});});await expect(card(page).getByRole("button",{name:"Retry audio request"})).toBeVisible();
  await page.unroute("**/v1/learning/attempts/*/audio");await page.reload();
  await expect(card(page).getByRole("button",{name:"Part 1",exact:true})).toContainText("Listened");expect(await page.evaluate(()=>(window as any).ieltsSpeech.calls)).toBe(0);
  await expect(group(page,1).getByRole("radio",{name:option.text,exact:true})).toBeChecked();
  await card(page).getByRole("button",{name:"Listen slowly · 0.72×"}).click();await expect(card(page).getByText(/2 completed · 1 replays · 1 slow listens · 2 failed/)).toBeVisible();
  await card(page).getByRole("button",{name:"Part 2",exact:true}).click();let report:unknown;
  await page.route("**/v1/learning/attempts/*/audio",async route=>{if(route.request().postDataJSON().status==="completed"){report=route.request().postDataJSON();await route.abort("failed");}else await route.continue();});
  await card(page).getByRole("button",{name:"Play recording",exact:true}).click();await expect(card(page).getByRole("button",{name:"Retry audio request"})).toBeVisible();
  await page.unroute("**/v1/learning/attempts/*/audio");await page.reload();await expect(card(page).getByRole("button",{name:"Part 2",exact:true})).toHaveAttribute("aria-current","step");
  const retried=page.waitForRequest(r=>r.url().endsWith(`/${a.attemptId}/audio`));await card(page).getByRole("button",{name:"Retry audio request"}).click();expect((await retried).postDataJSON()).toEqual(report);
  await expect(card(page).getByRole("button",{name:"Part 2",exact:true})).toContainText("Listened");expect(await page.evaluate(()=>(window as any).ieltsSpeech.calls)).toBe(0);
  await playPart(page,3);await card(page).getByRole("button",{name:"Part 4",exact:true}).click();await page.evaluate(()=>{(window as any).ieltsSpeech.mode="hold";});
  await card(page).getByRole("button",{name:"Play recording",exact:true}).click();await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();
  await page.clock.fastForward(91_000);await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();await expect(card(page).getByRole("button",{name:"Submit choices",exact:true})).toBeDisabled();
  await page.evaluate(()=>{(window as any).ieltsSpeech.current.onend({});});await expect(card(page).getByRole("button",{name:"Submit choices",exact:true})).toBeEnabled();
  await page.route("**/v1/learning/attempts/*/submit",async route=>{const r=await route.fetch();expect(r.ok()).toBe(true);await route.abort("failed");},{times:1});
  await submitPartial(page);await expect(card(page).getByRole("button",{name:"Retry same answer"})).toBeVisible();await page.reload();
  await expect(card(page).getByRole("heading",{name:"Listening practice saved"})).toBeVisible();await expect(card(page).getByText("1/40 correct",{exact:true})).toBeVisible();
  const saved=await(await request.get(path(a),{headers:user.headers})).json();expect(saved.result.ielts.answers[0].optionId).toBe(option.id);expect(saved.result.listening.events.filter((e:{status:string})=>e.status==="failed")).toHaveLength(2);
  expect(await history(request,user.headers)).toHaveLength(1);
});

test("Listening pending answers retry exactly and account changes cancel playback and ignore late media events",async({page,request})=>{
  const first=await learner(request),second=await learner(request),a=await login(page,first.token);await playAll(page);
  const choice=correct(questions(a)[0]);await group(page,1).getByRole("radio",{name:choice.text,exact:true}).check();let payload:unknown;
  await page.route("**/v1/learning/attempts/*/submit",async route=>{payload=route.request().postDataJSON();await route.abort("failed");},{times:1});
  await submitPartial(page);await expect(card(page).getByRole("button",{name:"Retry same answer"})).toBeVisible();await page.reload();
  await expect(card(page).locator("input:enabled")).toHaveCount(0);await expect(card(page).getByRole("button",{name:"Part 2",exact:true})).toBeDisabled();
  const retried=page.waitForRequest(r=>r.url().endsWith(`/${a.attemptId}/submit`));await card(page).getByRole("button",{name:"Retry same answer"}).click();expect((await retried).postDataJSON()).toEqual(payload);
  await expect(card(page).getByRole("heading",{name:"Listening practice saved"})).toBeVisible();
  const opened=issued(page);await card(page).getByRole("button",{name:"Start another Listening practice"}).click();const next=await(await opened).json();
  await page.evaluate(()=>{(window as any).ieltsSpeech.mode="hold";});await card(page).getByRole("button",{name:"Play recording",exact:true}).click();await expect(card(page).getByText("Playing — listen to the end…",{exact:true})).toBeVisible();
  const switched=issued(page);await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},second.token);const other=await(await switched).json();expect(other.attemptId).not.toBe(next.attemptId);
  await page.evaluate(()=>{(window as any).ieltsSpeech.lateEnd?.({});});expect(await page.evaluate(()=>(window as any).ieltsSpeech.cancelled)).toBeGreaterThan(0);
  await expect(card(page).getByText(/0\/4 parts listened to completion/)).toBeVisible();await expect(card(page).locator("input:checked")).toHaveCount(0);
  expect((await request.get(path(a),{headers:second.headers})).status()).toBe(404);expect(await history(request,second.headers)).toEqual([]);expect(await history(request,first.headers)).toHaveLength(1);
});

test("Listening preserves a corrupt audio reference for explicit recovery and can report playback with storage blocked",async({page,request})=>{
  const user=await learner(request),a=await login(page,user.token),choice=correct(questions(a)[0]);await group(page,1).getByRole("radio",{name:choice.text,exact:true}).check();
  const key=`loccao.listening-audio.v1.${a.attemptId}`;await page.evaluate(key=>localStorage.setItem(key,"broken-json"),key);await page.reload();
  await expect(card(page).getByRole("alert")).toContainText("saved audio request could not be read");expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe("broken-json");
  await expect(group(page,1).getByRole("radio",{name:choice.text,exact:true})).toBeChecked();await card(page).getByRole("button",{name:"Discard invalid audio reference"}).click();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  await page.addInitScript(()=>{const read=Storage.prototype.getItem,write=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key.startsWith("loccao.listening-audio."))throw new DOMException("Blocked","SecurityError");return read.call(this,key);};Storage.prototype.setItem=function(key,value){if(key.startsWith("loccao.listening-audio."))throw new DOMException("Blocked","SecurityError");return write.call(this,key,value);};});
  await page.reload();await playAll(page);await expect(card(page).getByText(/Browser storage is unavailable. Keep this tab open to confirm playback/)).toBeVisible();
  await submitPartial(page);await expect(card(page).getByText("1/40 correct",{exact:true})).toBeVisible();expect(await history(request,user.headers)).toHaveLength(1);
});

test("Listening ignores an audio preparation response from the previous account",async({page,request})=>{
  const first=await learner(request),second=await learner(request),a=await login(page,first.token);
  let release!:()=>void,arrived!:()=>void,finished!:()=>void;
  const gate=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{arrived=r;}),done=new Promise<void>(r=>{finished=r;});
  await page.route(`**/v1/learning/attempts/${a.attemptId}/audio`,async route=>{
    const response=await route.fetch();expect(response.ok()).toBe(true);arrived();await gate;
    try{await route.fulfill({response});}finally{finished();}
  },{times:1});
  await card(page).getByRole("button",{name:"Play recording",exact:true}).click();await started;
  const opened=issued(page);await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},second.token);
  const next:Paper=await(await opened).json();expect(next.attemptId).not.toBe(a.attemptId);release();await done;
  await expect(card(page).getByText(/0\/4 parts listened to completion/)).toBeVisible();expect(await page.evaluate(()=>(window as any).ieltsSpeech.calls)).toBe(0);
  expect((await(await request.get(path(next),{headers:second.headers})).json()).listening.events).toEqual([]);
  await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},first.token);
  await expect(card(page).getByRole("button",{name:"Retry audio request"})).toBeVisible();
  await card(page).getByRole("button",{name:"Retry audio request"}).click();await expect(card(page).getByRole("button",{name:"Part 1",exact:true})).toContainText("Listened");
  expect((await(await request.get(path(a),{headers:first.headers})).json()).listening.events).toHaveLength(1);
});

for(const height of [551,844])test(`Listening forty-question paper is keyboard playable and readable at 390x${height}`,async({page,request})=>{
  await page.setViewportSize({width:390,height});const user=await learner(request),a=await login(page,user.token);await playAll(page);
  const option=correct(questions(a)[0]),radio=group(page,1).getByRole("radio",{name:option.text,exact:true});await radio.focus();await page.keyboard.press("Space");await expect(radio).toBeChecked();
  let count=0;for(let part=1;part<=4;part++){await card(page).getByRole("button",{name:`Part ${part}`,exact:true}).click();count+=await card(page).getByRole("group").count();}expect(count).toBe(40);
  await card(page).getByRole("button",{name:"Part 1",exact:true}).click();await expect(radio).toBeChecked();
  expect(await group(page,1).locator("legend").evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  for(const label of await group(page,1).locator("label").all())expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await group(page,1).scrollIntoViewIfNeeded();await page.screenshot({path:`.cache/ielts-listening-${height}.png`});
  await submitPartial(page);await expect(card(page).getByText("1/40 correct",{exact:true})).toBeVisible();await expect(group(page,1).getByText(`Your answer: ${option.text}`,{exact:true})).toBeVisible();
  await card(page).getByText("Review recording transcript",{exact:true}).click();await expect(card(page).getByText(catalog.sections[0].transcript,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await card(page).getByRole("heading",{name:"Listening practice saved"}).scrollIntoViewIfNeeded();await page.screenshot({path:`.cache/ielts-listening-feedback-${height}.png`});
});
