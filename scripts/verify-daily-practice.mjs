import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";

const base=process.env.E2E_API_URL||"http://localhost:8080";
async function call(path,method="GET",body,token){
 const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
const registered=await call("/v1/auth/register","POST",{email:`daily-integration-${randomUUID()}@example.test`,password:"SunlitTest123!",displayName:"Daily Integration"});
assert.equal(registered.status,201);const {token,user}=registered.data;
assert.equal((await call("/v1/player/daily")).status,401);
assert.equal((await call("/v1/player/daily/claim","POST",{})).status,401);
assert.equal((await call("/v1/player/profile","PUT",{goal:"ielts",cefrLevel:"B1",dailyMinutes:15,targetBand:7,interests:["daily-life"]},token)).status,200);
const initial=await call("/v1/player/daily","GET",undefined,token);
assert.equal(initial.status,200);const plan=initial.data;
assert.equal(plan.method,"completed-practice.v1");assert.equal(plan.total,3);assert.equal(plan.completed,0);
assert.equal(new Set(plan.quests.map(q=>q.activity)).size,3);
const input={date:plan.date,rulesVersion:plan.rulesVersion};
assert.equal((await call("/v1/player/daily/claim","POST",input,token)).status,409);
assert.equal((await call("/v1/player/daily/claim","POST",{...input,rewardXp:999},token)).status,400);
assert.equal((await call("/v1/player/daily/claim","POST",{...input,rulesVersion:"daily-plan.future"},token)).status,409);
const readings=JSON.parse(await readFile(new URL("../backend/internal/learning/reading_catalog.json",import.meta.url),"utf8"));
const sentences=JSON.parse(await readFile(new URL("../backend/internal/learning/sentence_catalog.json",import.meta.url),"utf8"));
const evidence=[];
for(const quest of plan.quests){
 const opened=await call("/v1/learning/attempts","POST",{requestId:randomUUID(),activity:quest.activity,pack:"cefr-core",cefrLevel:"B1",excludeItemKeys:[]},token);
 assert.equal(opened.status,201);const attempt=opened.data;let answer="Something entirely unrelated.";
 if(quest.activity==="reading-race")answer=attempt.prompt.options.find(option=>option!==readings.items.find(item=>item.id===attempt.itemKey).correctAnswer);
 if(quest.activity==="sentence-builder"){
  const chunks=[...attempt.prompt.chunks],reference=sentences.items.find(item=>item.id===attempt.itemKey).chunks;
  const order=reference.map(text=>chunks.splice(chunks.findIndex(chunk=>chunk.text===text),1)[0].id);order.push(order.shift());answer=JSON.stringify(order);
 }
 const submitted=await call(`/v1/learning/attempts/${attempt.attemptId}/submit`,"POST",{answer,contentVersion:attempt.contentVersion,rulesVersion:attempt.rulesVersion},token);
 assert.equal(submitted.status,200);assert.equal(submitted.data.correct,false);assert.equal(submitted.data.xpDelta,0);evidence.push(attempt.attemptId);
}
assert.equal((await call("/v1/player/profile","PUT",{goal:"travel",cefrLevel:"A2",dailyMinutes:30,targetBand:7,interests:["travel"]},token)).status,200);
const ready=await call("/v1/player/daily","GET",undefined,token);
assert.equal(ready.data.claimable,true);assert.deepEqual(ready.data.quests.map(({complete,...q})=>q),plan.quests.map(({complete,...q})=>q));
const claims=await Promise.all(Array.from({length:8},()=>call("/v1/player/daily/claim","POST",input,token)));
for(const result of claims){assert.equal(result.status,200);assert.equal(result.data.claimed,true);assert.equal(result.data.receipt.rewardXp,50);assert.deepEqual(result.data.receipt,claims[0].data.receipt);}
const receipt=await call(`/v1/player/daily/claims/${input.date}`,"GET",undefined,token);
assert.equal(receipt.status,200);assert.deepEqual(receipt.data.evidence.map(e=>e.attemptId).sort(),evidence.sort());
assert.equal((await call("/v1/me","GET",undefined,token)).data.user.xp,50);
assert.equal((await call("/v1/social/leaderboard?limit=100","GET",undefined,token)).data.items.some(row=>row.userId===user.id),false);
const restored=await call("/v1/player/daily","GET",undefined,token);assert.equal(restored.data.claimed,true);assert.deepEqual(restored.data.receipt,receipt.data);
console.log("Stable owned daily plans, actual wrong-answer completions, dated concurrent claims, one 50 XP receipt, restore and checked-rank exclusion passed.");
