import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";

const base=process.env.E2E_API_URL||"http://localhost:8080";
async function call(path,method="GET",body,token){
 const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
const registered=await call("/v1/auth/register","POST",{email:`reward-integration-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:"Checked Integration"});
assert.equal(registered.status,201);const {token,user}=registered.data;
const before=await call("/v1/dashboard","GET",undefined,token);
assert.equal((await call("/v1/attempts","POST",{activity:"renamed-client-score",skill:"Vocabulary",itemKey:"forged",accuracy:1},token)).status,409);
assert.equal((await call("/v1/social/challenges/fake/submit","POST",{score:999999},token)).status,409);
const unchanged=await call("/v1/dashboard","GET",undefined,token);
assert.equal(unchanged.data.user.xp,before.data.user.xp);assert.deepEqual(unchanged.data.skills,before.data.skills);
const opened=await call("/v1/learning/attempts","POST",{requestId:randomUUID(),activity:"word-link",pack:"cefr-core",cefrLevel:"A1",excludeItemKeys:[]},token);
assert.equal(opened.status,201);const attempt=opened.data;
const bank=JSON.parse(await readFile(new URL("../backend/internal/learning/catalog.json",import.meta.url),"utf8"));
const answer=bank.items.find(item=>item.id===attempt.itemKey).correctAnswer;
const input={answer,contentVersion:attempt.contentVersion,rulesVersion:attempt.rulesVersion};
const outcomes=await Promise.all(Array.from({length:6},()=>call(`/v1/learning/attempts/${attempt.attemptId}/submit`,"POST",input,token)));
for(const outcome of outcomes){assert.equal(outcome.status,200);assert.equal(outcome.data.xpDelta,20);}
const board=await call("/v1/social/leaderboard?limit=100","GET",undefined,token);
assert.equal(board.data.method,"server-checked-practice.v1");assert.equal(board.data.items.find(row=>row.userId===user.id).xp,20);
assert.equal((await call("/v1/me","GET",undefined,token)).data.user.xp,20);
assert.equal((await call("/v1/lessons/work-meeting-survival/complete","POST",{completed:3,score:1})).status,401);
const bookmark=await call("/v1/lessons/work-meeting-survival/complete","POST",{completed:3,score:1},token);
assert.equal(bookmark.status,200);assert.equal(bookmark.data.evidence,"client-reported-bookmark");
assert.equal((await call("/v1/me","GET",undefined,token)).data.user.xp,20);
console.log("Retired score routes, concurrent checked receipts, board provenance and advisory bookmarks passed.");
