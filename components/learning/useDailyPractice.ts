"use client";

import {useEffect,useRef,useState} from "react";
import {APIError,getMe,type DailyRun} from "@/lib/api";
import {getAuthToken} from "@/lib/session";
import {fetchDaily,fetchDailyReceipt,submitDailyClaim,type DailyClaimInput,type DailyReceipt} from "@/lib/daily-practice";

type Pending={schema:1;owner:string;date:string;rulesVersion:"daily-plan.v1"};
export default function useDailyPractice(token:string){
 const [run,setRun]=useState<DailyRun|null>(null),[pending,setPending]=useState<Pending|null>(null),[recovered,setRecovered]=useState<DailyReceipt|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState(""),[warning,setWarning]=useState(""),[corrupt,setCorrupt]=useState(false),[owner,setOwner]=useState(""),[needsSignIn,setNeedsSignIn]=useState(false);
 const active=useRef(false),locked=useRef(false),sequence=useRef(0),key=useRef(""),saved=useRef<Pending|null>(null);
 const current=(seq:number)=>active.current&&seq===sequence.current&&getAuthToken()===token;
 function failure(e:unknown,message:string){if(e instanceof APIError&&e.status===401){setNeedsSignIn(true);setError("Your session expired. Sign in again to check the saved claim; its reference is kept.");}else setError(message);}
 function clearPending(){
  if(!active.current||getAuthToken()!==token)return;
  saved.current=null;setPending(null);
  try{localStorage.removeItem(key.current);}catch{setWarning("This browser cannot update the recovery reference. Confirmed rewards stay in your account.");}
 }
 function confirm(receipt:DailyReceipt){setRecovered(receipt);clearPending();}
 async function readStatus(seq:number){
  const value=await fetchDaily(token);if(!current(seq))return;setRun(value);
  const ref=saved.current;
  if(ref){
   if(value.date===ref.date&&value.claimed&&value.receipt){confirm(value.receipt);return;}
   try{const receipt=await fetchDailyReceipt(ref.date,token);if(current(seq))confirm(receipt);}
   catch(e){if(current(seq))failure(e,e instanceof APIError&&e.status===404?"The saved claim has not been confirmed. Retry that same claim, or explicitly leave its local reference before starting another day.":"Could not confirm the saved claim. Its date is kept; refresh again when connected.");}
  }
 }
 async function refresh(){
  if(locked.current||!active.current||getAuthToken()!==token)return;
  if(!key.current){window.location.reload();return;}
  const seq=++sequence.current;locked.current=true;setBusy(true);setError("");
  try{await readStatus(seq);}catch(e){if(current(seq))failure(e,"Could not refresh the saved daily plan. Your claim reference is kept.");}
  finally{if(current(seq)){locked.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  active.current=true;const seq=++sequence.current;locked.current=true;
  void(async()=>{
   try{
    const me=await getMe(token);if(!current(seq))return;
    setOwner(me.user.id);key.current=`loccao.daily-claim.v1.${me.user.id}`;
    let raw:string|null=null;
    try{raw=localStorage.getItem(key.current);}catch{setWarning("This browser cannot keep a recovery reference. Account rewards still save; reload may lose an unconfirmed earlier-day reference.");}
    if(raw){try{const value=JSON.parse(raw)as Pending;if(value.schema!==1||value.owner!==me.user.id||value.rulesVersion!=="daily-plan.v1"||typeof value.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value.date))throw Error();saved.current=value;setPending(value);}catch{setCorrupt(true);setWarning("The local claim reference cannot be read. It is kept until you explicitly leave it; your account history is unchanged.");}}
    await readStatus(seq);
   }catch(e){if(current(seq))failure(e,"Could not load the daily plan. Refresh to reconnect.");}
   finally{if(current(seq)){locked.current=false;setBusy(false);}}
  })();
  return()=>{active.current=false;sequence.current++;locked.current=false;};
 },[token]);
 async function claim(){
  if(locked.current||!active.current||getAuthToken()!==token||!owner||corrupt||!saved.current&&!run?.claimable)return;
  const input:DailyClaimInput=saved.current||{date:run!.date,rulesVersion:run!.rulesVersion};
  if(input.rulesVersion!=="daily-plan.v1"){setError("This daily plan needs an updated app. Your saved record is kept.");return;}
  const seq=++sequence.current;locked.current=true;setBusy(true);setError("");
  if(!saved.current){const ref:Pending={schema:1,owner,date:input.date,rulesVersion:"daily-plan.v1"};saved.current=ref;setPending(ref);try{localStorage.setItem(key.current,JSON.stringify(ref));}catch{setWarning("The recovery reference could not be saved on this browser. Keep this date until the reward is confirmed.");}}
  try{
   const value=await submitDailyClaim({date:input.date,rulesVersion:input.rulesVersion},token);if(!current(seq))return;
   if(!value.claimed||!value.receipt)throw Error("Missing receipt");
   if(!run||value.date===run.date)setRun(value);
   confirm(value.receipt);
  }catch(e){if(current(seq))failure(e,e instanceof APIError&&[400,409].includes(e.status)?e.message:"The reply was interrupted. Refresh saved status or retry the same dated claim; the reward will not be added twice.");}
  finally{if(current(seq)){locked.current=false;setBusy(false);}}
 }
 function leave(){if(locked.current)return;clearPending();setCorrupt(false);setError("");}
 return {run,pending,recovered,busy,error,warning,corrupt,needsSignIn,refresh,claim,leave};
}
