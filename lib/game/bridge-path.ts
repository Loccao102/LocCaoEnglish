/** Find an actual bank-to-bank route; every neighbouring port must be reciprocal. */
export function bridgePath(base:number[][],rotations:number[],entry:number,exit:number):number[]{
  const ports=base.map((values,i)=>values.map(value=>(value+rotations[i])%4)),start=entry*3,goal=exit*3+2;
  const seen=new Set<number>(),came=new Map<number,number>(),queue=ports[start].includes(3)?[start]:[];
  while(queue.length){
    const at=queue.shift()!;if(seen.has(at))continue;seen.add(at);
    for(const dir of ports[at]){
      const row=Math.floor(at/3)+[-1,0,1,0][dir],col=at%3+[0,1,0,-1][dir];
      if(row<0||row>2||col<0||col>2)continue;
      const next=row*3+col;
      if(ports[next].includes((dir+2)%4)&&!seen.has(next)&&!came.has(next)){came.set(next,at);queue.push(next);}
    }
  }
  if(!seen.has(goal)||!ports[goal].includes(1))return [];
  const path=[goal];let at=goal;
  while(at!==start){const previous=came.get(at);if(previous===undefined)return [];at=previous;path.unshift(at);}
  return path;
}
