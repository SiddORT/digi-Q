/** Search a bounded number of real public availability responses, without reserving a booking. */
export function nextVisitDate(date:string,days:number){
  const value=new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

type PublicSession = { available:boolean; remainingTokens:number; queueMode?:string|null };
export async function findNextBookableDate(
  fromDate:string,
  load:(date:string)=>Promise<PublicSession[]>,
  current:()=>boolean=()=>true,
  days=14,
){
  for(let offset=1;offset<=days;offset++){
    if(!current())return null;
    const date=nextVisitDate(fromDate,offset);
    const sessions=await load(date);
    if(!current())return null;
    if(sessions.some(session=>session.available&&session.remainingTokens>0&&session.queueMode!=="walkInsOnly"))return date;
  }
  return null;
}