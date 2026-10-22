import {randomUUID} from "node:crypto";
import {test,expect,type APIRequestContext,type Page} from "@playwright/test";
import type {DailyRun} from "../../lib/api";
import type {LearningAttempt} from "../../lib/learning-attempt";
import readings from "../../backend/internal/learning/reading_catalog.json";
import sentences from "../../backend/internal/learning/sentence_catalog.json";

const API=process.env.E2E_API_URL||"http://localhost:8080";
type DailyAccount={token:string;user:{id:string};headers:Record<string,string>;run:DailyRun};
const panel=(page:Page)=>page.getByRole("article",{name:"Daily practice"});
// Isolate this account/receipt fixture burst without changing server limits.
test.beforeAll(async()=>{test.setTimeout(90000);await new Promise(resolve=>setTimeout(resolve,60000));});
test.afterAll(async()=>{test.setTimeout(90000);await new Promise(resolve=>setTimeout(resolve,60000));});
async function account(page:Page,request:APIRequestContext):Promise<DailyAccount>{
 const response=await request.post(`${API}/v1/auth/register`,{data:{email:`daily-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:"Daily explorer"}});
 expect(response.ok()).toBe(true);const user=await response.json();const headers={Authorization:`Bearer ${user.token}`};
 await page.goto("/account");await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},user.token);
 expect((await request.put(`${API}/v1/player/profile`,{headers,data:{goal:"ielts",cefrLevel:"B1",dailyMinutes:15,targetBand:7,interests:["daily-life"]}})).ok()).toBe(true);
 const runResponse=await request.get(`${API}/v1/player/daily`,{headers});expect(runResponse.ok()).toBe(true);const run:DailyRun=await runResponse.json();
 return {...user,headers,run};
}
async function finish(request:APIRequestContext,user:{headers:Record<string,string>},activity:string){
 const response=await request.post(`${API}/v1/learning/attempts`,{headers:user.headers,data:{requestId:randomUUID(),activity,pack:"cefr-core",cefrLevel:"B1",excludeItemKeys:[]}});
 expect(response.ok()).toBe(true);const attempt:LearningAttempt=await response.json();
 let answer="Something entirely unrelated.";
 if(activity==="reading-race"){const reference=readings.items.find(item=>item.id===attempt.itemKey)!.correctAnswer;answer=attempt.prompt.options.find(option=>option!==reference)!;}
 if(activity==="sentence-builder"){
  const texts=sentences.items.find(item=>item.id===attempt.itemKey)!.chunks,available=[...attempt.prompt.chunks!];
  const ordered=texts.map(text=>available.splice(available.findIndex(chunk=>chunk.text===text),1)[0]);ordered.push(ordered.shift()!);answer=JSON.stringify(ordered.map(chunk=>chunk.id));
 }
 const result=await request.post(`${API}/v1/learning/attempts/${attempt.attemptId}/submit`,{headers:user.headers,data:{answer,contentVersion:attempt.contentVersion,rulesVersion:attempt.rulesVersion}});
 expect(result.ok()).toBe(true);const verdict=await result.json();expect(verdict.correct).toBe(false);expect(verdict.xpDelta).toBe(0);
 return attempt;
}
async function ready(page:Page,request:APIRequestContext){const user=await account(page,request);for(const quest of user.run.quests)await finish(request,user,quest.activity);await page.goto("/camp");await expect(panel(page).getByRole("heading",{name:"Reward chest unlocked"})).toBeVisible();return user;}

test("Guests see the daily sign-in boundary without writing shared progress",async({page,request})=>{
 let reads=0;page.on("request",r=>{if(r.url().includes("/v1/player/daily"))reads++;});
 await page.goto("/camp");await expect(panel(page).getByRole("link",{name:"Sign in for daily practice"})).toBeVisible();expect(reads).toBe(0);
 expect((await request.get(`${API}/v1/player/daily`)).status()).toBe(401);expect((await request.post(`${API}/v1/player/daily/claim`,{data:{}})).status()).toBe(401);
});

test("The saved daily plan survives real practice and a lost committed chest response",async({page,request})=>{
 const user=await account(page,request);await page.goto("/camp");await expect(panel(page).getByRole("heading",{name:"0/3 activities finished"})).toBeVisible();
 const shadow=user.run.quests.find(q=>q.activity==="shadowing")!;
 const opened=page.waitForResponse(r=>r.url().endsWith("/v1/learning/attempts")&&r.request().method()==="POST");
 await panel(page).getByRole("link",{name:new RegExp(shadow.title)}).click();await opened;
 const speaking=page.getByRole("region",{name:"Guided speaking practice"});await speaking.getByRole("textbox",{name:"Your transcript"}).fill("Something entirely unrelated.");await speaking.getByRole("button",{name:"Check transcript",exact:true}).click();await expect(speaking.getByText("Compare your words",{exact:true})).toBeVisible();
 for(const quest of user.run.quests.filter(q=>q.activity!=="shadowing"))await finish(request,user,quest.activity);
 expect((await request.put(`${API}/v1/player/profile`,{headers:user.headers,data:{goal:"travel",cefrLevel:"B1",dailyMinutes:30,targetBand:7,interests:["travel"]}})).ok()).toBe(true);
 await page.goto("/camp");await expect(panel(page).getByRole("heading",{name:"Reward chest unlocked"})).toBeVisible();
 const frozen:DailyRun=await(await request.get(`${API}/v1/player/daily`,{headers:user.headers})).json();expect(frozen.quests.map(({complete,...q})=>q)).toEqual(user.run.quests.map(({complete,...q})=>q));
 let payload:unknown;
 await page.route("**/v1/player/daily/claim",async route=>{payload=route.request().postDataJSON();const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort("failed");},{times:1});
 await panel(page).getByRole("button",{name:"Open daily chest · +50 XP",exact:true}).click();await expect(panel(page).getByRole("alert")).toContainText("reply was interrupted");
 expect(payload).toEqual({date:user.run.date,rulesVersion:"daily-plan.v1"});
 const key=`loccao.daily-claim.v1.${user.user.id}`;expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key)).toMatchObject({owner:user.user.id,date:user.run.date,rulesVersion:"daily-plan.v1"});
 await page.reload();await expect(panel(page).getByRole("heading",{name:"Chest claimed"})).toBeVisible();await expect(panel(page).getByRole("status")).toContainText("Confirmed reward");
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
 for(let i=0;i<3;i++)expect((await request.post(`${API}/v1/player/daily/claim`,{headers:user.headers,data:payload})).ok()).toBe(true);
 expect((await(await request.get(`${API}/v1/me`,{headers:user.headers})).json()).user.xp).toBe(50);
 const board=await(await request.get(`${API}/v1/social/leaderboard`,{headers:user.headers})).json();expect(board.items.some((row:any)=>row.userId===user.user.id)).toBe(false);
});

test("An uncommitted daily claim keeps the same date and version after reload",async({page,request})=>{
 const user=await ready(page,request);let payload:unknown;
 await page.route("**/v1/player/daily/claim",route=>{payload=route.request().postDataJSON();return route.abort("failed");},{times:1});
 await panel(page).getByRole("button",{name:"Open daily chest · +50 XP",exact:true}).click();await expect(panel(page).getByRole("alert")).toContainText("reply was interrupted");
 await page.reload();await expect(panel(page).getByRole("alert")).toContainText("saved claim has not been confirmed");
 const retry=page.waitForRequest(r=>r.url().endsWith("/v1/player/daily/claim")&&r.method()==="POST");await panel(page).getByRole("button",{name:/Retry saved claim/}).click();expect((await retry).postDataJSON()).toEqual(payload);
 await expect(panel(page).getByRole("heading",{name:"Chest claimed"})).toBeVisible();expect((await(await request.get(`${API}/v1/me`,{headers:user.headers})).json()).user.xp).toBe(50);
});

test("A late daily claim reply cannot update another account",async({page,request})=>{
 const first=await ready(page,request);const response=await request.post(`${API}/v1/auth/register`,{data:{email:`daily-other-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:"Other daily explorer"}});expect(response.ok()).toBe(true);const other=await response.json();
 let release!:()=>void,committed!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;}),saved=new Promise<void>(resolve=>{committed=resolve;});
 await page.route("**/v1/player/daily/claim",async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);committed();await hold;await route.fulfill({response});});
 await panel(page).getByRole("button",{name:"Open daily chest · +50 XP",exact:true}).click();await saved;
 await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},other.token);
 await expect(panel(page).getByRole("heading",{name:"0/3 activities finished"})).toBeVisible();release();
 await panel(page).getByRole("button",{name:"Refresh saved status"}).click();await expect(panel(page).getByRole("heading",{name:"0/3 activities finished"})).toBeVisible();await expect(panel(page).getByText("Reward banked",{exact:true})).toHaveCount(0);
 await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},first.token);await expect(panel(page).getByRole("heading",{name:"Chest claimed"})).toBeVisible();
});

test("An expired daily session retains its pending reference until sign-in recovers it",async({page,request})=>{
 const user=await ready(page,request);await page.route("**/v1/player/daily/claim",route=>route.abort("failed"),{times:1});await panel(page).getByRole("button",{name:"Open daily chest · +50 XP",exact:true}).click();await expect(panel(page).getByRole("alert")).toBeVisible();
 const key=`loccao.daily-claim.v1.${user.user.id}`,before=await page.evaluate(key=>localStorage.getItem(key),key);
 await page.route("**/v1/me",route=>route.fulfill({status:401,json:{error:"expired"}}));await page.reload();await expect(panel(page).getByRole("link",{name:"Sign in again"})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);
 await page.unroute("**/v1/me");await page.route("**/v1/player/daily/claims/*",route=>route.fulfill({status:401,json:{error:"expired"}}));await page.reload();await expect(panel(page).getByRole("link",{name:"Sign in again"})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);
 await page.unroute("**/v1/player/daily/claims/*");await page.reload();await expect(panel(page).getByRole("button",{name:/Retry saved claim/})).toBeVisible();await panel(page).getByRole("button",{name:/Retry saved claim/}).click();await expect(panel(page).getByRole("heading",{name:"Chest claimed"})).toBeVisible();
});

test("Corrupt daily recovery is kept until explicit release",async({page,request})=>{
 const user=await ready(page,request),key=`loccao.daily-claim.v1.${user.user.id}`;await page.evaluate(key=>localStorage.setItem(key,"{broken"),key);await page.reload();await expect(panel(page).getByText(/local claim reference cannot be read/)).toBeVisible();
 await expect(panel(page).getByRole("button",{name:"Open daily chest · +50 XP",exact:true})).toBeDisabled();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe("{broken");
 await panel(page).getByRole("button",{name:"Leave local claim reference"}).click();await expect(panel(page).getByRole("button",{name:"Open daily chest · +50 XP",exact:true})).toBeEnabled();expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});

test("Daily reward remains usable with a warning when recovery storage is blocked",async({page,request})=>{
 const user=await ready(page,request);await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;Storage.prototype.getItem=function(key){if(key.startsWith("loccao.daily-claim."))throw new DOMException("blocked","SecurityError");return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key.startsWith("loccao.daily-claim."))throw new DOMException("full","QuotaExceededError");return set.call(this,key,value);};Storage.prototype.removeItem=function(key){if(key.startsWith("loccao.daily-claim."))throw new DOMException("blocked","SecurityError");return remove.call(this,key);};});
 await page.reload();await expect(panel(page).getByText(/cannot keep a recovery reference/)).toBeVisible();await panel(page).getByRole("button",{name:"Open daily chest · +50 XP",exact:true}).click();await expect(panel(page).getByRole("heading",{name:"Chest claimed"})).toBeVisible();
 await page.reload();await expect(panel(page).getByRole("heading",{name:"Chest claimed"})).toBeVisible();expect((await(await request.get(`${API}/v1/me`,{headers:user.headers})).json()).user.xp).toBe(50);
});

for(const height of [551,844])test(`Saved daily checklist and chest remain readable at 390x${height}`,async({page,request})=>{
 await page.setViewportSize({width:390,height});await ready(page,request);const card=panel(page);await card.scrollIntoViewIfNeeded();
 for(const title of await card.locator(".daily-quest strong").all())expect(Number.parseFloat(await title.evaluate(el=>getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 const button=card.getByRole("button",{name:"Open daily chest · +50 XP",exact:true});await button.scrollIntoViewIfNeeded();expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/daily-practice-${height}.png`});await card.evaluate(el=>el.scrollIntoView({block:"start"}));await page.evaluate(()=>scrollBy(0,-150));await page.screenshot({path:`test-results/daily-practice-checklist-${height}.png`});await button.click();await expect(card.getByRole("heading",{name:"Chest claimed"})).toBeVisible();
});
