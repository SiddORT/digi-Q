/** Search a bounded number of real public availability responses, without reserving a booking. */
export function validVisitDate(date:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
}
export function nextVisitDate(date:string,days:number){
  const value=new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

type PublicSession = { available:boolean; remainingTokens:number; queueMode?:string|null; startTime?:string|null; queueOpenTime?:string|null; breakStart?:string|null; breakEnd?:string|null };
export function bookingSessionIssue(session:PublicSession,walkIn=false,date="",today="",time=""):string|null{
  if(!session.available)return "Session unavailable";
  if(session.remainingTokens<=0)return "Session full";
  if(!walkIn&&session.queueMode==="walkInsOnly")return "This session accepts walk-ins only. Choose another session or date for advance booking.";
  if(walkIn&&session.queueMode==="appointmentsOnly")return "This session accepts advance appointments only. Change booking mode or choose another session.";
  if(walkIn&&date!==today)return "Walk-ins are today-only in the location timezone.";
  if(walkIn&&time<(session.queueOpenTime||session.startTime||""))return "The queue has not opened yet.";
  if(walkIn&&session.breakStart&&session.breakEnd&&time>=session.breakStart&&time<session.breakEnd)return "The doctor is on a break.";
  return null;
}
export async function findNextBookableDate(
  fromDate:string,
  load:(date:string)=>Promise<PublicSession[]>,
  current:()=>boolean=()=>true,
  days=14,
   lastDate?:string,
){
  for(let offset=1;offset<=days;offset++){
    if(!current())return null;
    const date=nextVisitDate(fromDate,offset);
     if(lastDate&&date>lastDate)return null;
    const sessions=await load(date);
    if(!current())return null;
     if(sessions.some(session=>!bookingSessionIssue(session)))return date;
  }
  return null;
}