import {randomUUID} from "node:crypto";
import {test, expect, type APIRequestContext, type Page} from "@playwright/test";
import words from "../../backend/internal/learning/catalog.json";
import type {LearningAttempt} from "../../lib/learning-attempt";

const API=process.env.E2E_API_URL||"http://localhost:8080";
async function account(page:Page,request:APIRequestContext){
 const name=`Checked learner ${randomUUID().slice(0,8)}`;
 const response=await request.post(`${API}/v1/auth/register`,{data:{email:`reward-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:name}});
 expect(response.ok()).toBe(true);const result=await response.json();
 await page.goto("/account");await page.evaluate(token=>{localStorage.setItem("loccao_token",token);window.dispatchEvent(new Event("loccao-auth-change"));},result.token);
 return {...result,name,headers:{Authorization:`Bearer ${result.token}`}};
}

test("Arbitrary client score names cannot change XP, confidence, reviews or rank",async({page,request})=>{
 const user=await account(page,request),headers=user.headers;
 const before=await(await request.get(`${API}/v1/dashboard`,{headers})).json();
 for(const activity of ["renamed-game","placement","lesson-choice","lesson-input","UNKNOWN SCORE"]){
  const response=await request.post(`${API}/v1/attempts`,{headers,data:{activity,skill:"Vocabulary",itemKey:randomUUID(),accuracy:1,prompt:"forged",answer:"reference"}});
  expect(response.status()).toBe(409);
 }
 expect((await request.post(`${API}/v1/social/challenges/fake/submit`,{headers,data:{score:999999}})).status()).toBe(409);
 const after=await(await request.get(`${API}/v1/dashboard`,{headers})).json();
 expect(after.user.xp).toBe(before.user.xp);expect(after.skills).toEqual(before.skills);expect(after.dueReviews).toBe(before.dueReviews);
 const board=await(await request.get(`${API}/v1/social/leaderboard`,{headers})).json();
 expect(board.method).toBe("server-checked-practice.v1");expect(board.items.some((row:any)=>row.userId===user.user.id)).toBe(false);
});

test("A real Word Link receipt contributes to the checked board once after lost response",async({page,request})=>{
 const user=await account(page,request);
 const opened=page.waitForResponse(r=>r.url().endsWith("/v1/learning/attempts")&&r.request().method()==="POST");
 await page.goto("/games/word-link");const attempt:LearningAttempt=await(await opened).json();
 const answer=words.items.find(item=>item.id===attempt.itemKey)!.correctAnswer;
 await page.route("**/v1/learning/attempts/*/submit",async route=>{expect((await route.fetch()).ok()).toBe(true);await route.abort("failed");},{times:1});
 await page.locator(".word-option").filter({hasText:answer}).click();
 await expect(page.getByRole("button",{name:"Retry same answer"})).toBeVisible();
 await page.reload();await expect(page.getByText("+20 XP · Progress saved.",{exact:true})).toBeVisible();
 for(let i=0;i<3;i++)expect((await request.post(`${API}/v1/learning/attempts/${attempt.attemptId}/submit`,{headers:user.headers,data:{answer,contentVersion:attempt.contentVersion,rulesVersion:attempt.rulesVersion}})).ok()).toBe(true);
 const board=await(await request.get(`${API}/v1/social/leaderboard`,{headers:user.headers})).json();
 expect(board.items.find((row:any)=>row.userId===user.user.id).xp).toBe(20);
 await page.goto("/social");await expect(page.getByText("CHECKED PRACTICE XP",{exact:true})).toBeVisible();
 await expect(page.locator(".leader-list > div").filter({hasText:user.name})).toContainText("20 checked XP");
 await page.getByRole("button",{name:"Create practice invitation"}).click();
 await expect(page.locator(".challenge-card").filter({hasText:user.name})).toContainText("Open practice");
 await expect(page.getByText(/do not create head-to-head scores/)).toBeVisible();
});

for(const height of [900,551,844])test(`Open lesson responses are ungraded and failed bookmarks can retry at ${height}px`,async({page,request})=>{
 if(height!==900)await page.setViewportSize({width:390,height});
 const user=await account(page,request);let oldWrites=0;
 page.on("request",r=>{if(r.url().endsWith("/v1/attempts"))oldWrites++;});
 await page.goto("/learn/work-meeting-survival");
 await page.getByRole("button",{name:"Could you clarify what you mean by the rollout window?",exact:true}).click();
 await page.getByRole("button",{name:"Compare with reference"}).click();
 await expect(page.getByRole("button",{name:"Could you clarify what you mean by the rollout window?",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Next →"}).click();
 await page.getByRole("textbox").fill("however");await page.getByRole("button",{name:"Compare with reference"}).click();await page.getByRole("button",{name:"Next →"}).click();
 await expect(page.getByRole("button",{name:"Review my response"})).toBeDisabled();
 await page.getByRole("textbox").fill("Banana.");await page.getByRole("button",{name:"Review my response"}).click();
 await expect(page.getByText("Response noted locally · ungraded",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/lesson-ungraded-${height}.png`,fullPage:true});
 await page.route("**/v1/lessons/*/complete",route=>route.abort("failed"),{times:1});
 await page.getByRole("button",{name:"Finish lesson"}).click();
 await expect(page.locator(".lesson-player").getByRole("alert")).toContainText("bookmark was not confirmed");
 await page.getByRole("button",{name:"Finish lesson"}).click();
 await expect(page.getByText("2/2",{exact:true})).toBeVisible();
 await expect(page.getByText(/open responses are ungraded/)).toBeVisible();expect(oldWrites).toBe(0);
 expect((await(await request.get(`${API}/v1/me`,{headers:user.headers})).json()).user.xp).toBe(0);
});

test("Guest placement chooses practice without sending accuracy or changing shared demo progress",async({page,request})=>{
 const before=await(await request.get(`${API}/v1/dashboard`)).json();let writes=0;
 page.on("request",r=>{if(r.method()!=="GET"&&["/v1/attempts","/v1/player/profile"].some(path=>r.url().endsWith(path)))writes++;});
 await page.goto("/placement");
 for(let i=0;i<12;i++){await page.locator(".choice-stack button").first().click();await page.getByRole("button",{name:i===11?"Finish calibration →":"Lock answer →"}).click();}
 await expect(page.getByRole("heading",{name:/Suggested starting level:/})).toBeVisible();
 await expect(page.getByText(/does not award XP, change skill confidence/)).toBeVisible();expect(writes).toBe(0);
 const after=await(await request.get(`${API}/v1/dashboard`)).json();expect(after.user.xp).toBe(before.user.xp);expect(after.skills).toEqual(before.skills);
});

for(const height of [551,844])test(`Checked practice community stays readable at 390x${height}`,async({page})=>{
 await page.setViewportSize({width:390,height});await page.goto("/social");
 await expect(page.getByRole("heading",{name:"Practise together, track checked progress."})).toBeVisible();
 await page.getByText("CHECKED PRACTICE XP",{exact:true}).scrollIntoViewIfNeeded();
 await expect(page.getByText(/Guided practice is not a skill certification/)).toBeVisible();
 const ranks=page.locator(".leader-list strong");
 for(const row of await ranks.all())expect(Number.parseFloat(await row.evaluate(el=>getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/checked-practice-${height}.png`,fullPage:true});
});
