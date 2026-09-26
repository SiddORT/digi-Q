export type ScheduleLike={id?:string;dayOfWeek:number;startTime:string;endTime:string;maxTokens?:number|null;[k:string]:unknown};
const COPY_KEYS=["doctorId","clinicId","branchId","isOpen","startTime","endTime","breakStart","breakEnd","timezone","tokenPrefix","maxTokens","consultationMinutes","bufferMinutes","queueMode","queueOpenTime","queueCloseTime"];
const COMPARE=["startTime","endTime","breakStart","breakEnd","maxTokens","consultationMinutes","tokenPrefix","queueMode","isOpen"];
const overlaps=(a:ScheduleLike,b:ScheduleLike)=>a.startTime<b.endTime&&b.startTime<a.endTime;
export function planCopy(rows:ScheduleLike[],sourceDay:number,targets:number[]){
  const creates:Record<string,unknown>[]=[];const skipped:string[]=[];const conflicts:string[]=[];
  for(const day of targets){if(day===sourceDay)continue;for(const r of rows.filter(x=>x.dayOfWeek===sourceDay)){
    const existing=rows.filter(x=>x.dayOfWeek===day&&overlaps(x,r));
    if(existing.some(x=>COMPARE.every(k=>(x[k]??null)===(r[k]??null)))){skipped.push(`${day}:${r.startTime}`);continue;}
    if(existing.length){conflicts.push(`${day}:${r.startTime}-${r.endTime} overlaps ${existing.map(x=>`${x.startTime}-${x.endTime}`).join(", ")}`);continue;}
    // Only plain schedule fields are copied; lineage/link metadata stays on the source.
    creates.push({...Object.fromEntries(COPY_KEYS.filter(k=>r[k]!=null&&r[k]!=="").map(k=>[k,r[k]])),dayOfWeek:day});
  }}
  return {creates,skipped,conflicts};
}
