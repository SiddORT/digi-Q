export function doctorWorkspaceScope(identity: {user?: {role: string} | null; doctorId?: string | null}) {
 const isDoctor=identity.user?.role==="doctor";
 return {isDoctor,doctorId:isDoctor?identity.doctorId||"":""};
}

type SessionIdentity={sessionId?:string|null;startTime?:string|null};
type TimedSession=SessionIdentity&{endTime?:string|null;date?:string;timezone?:string|null;snapshotOnly?:boolean};
export function sessionTimeLabel(session:TimedSession,now=new Date()){
 if(session.snapshotOnly)return "Saved appointment session";
 if(!session.date||!session.timezone||!session.startTime||!session.endTime)return "Scheduled session";
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:session.timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value]));
  const date=`${parts.year}-${parts.month}-${parts.day}`,clock=`${parts.hour}:${parts.minute}`;
  if(session.date<date||session.date===date&&session.endTime<=clock)return "Past session";
  if(session.date>date||session.startTime>clock)return "Upcoming session";
  return "Currently running";
 }catch{return "Scheduled session";}
}
export function sessionContextKey(session:SessionIdentity){
 return JSON.stringify([session.sessionId||"",session.startTime||""]);
}
export function resolveSessionContext<T extends TimedSession>(sessions:T[],initial?:SessionIdentity,now=new Date()){
 const matches=initial?.startTime?sessions.filter(item=>item.startTime===initial.startTime&&(!initial.sessionId||item.sessionId===initial.sessionId)):initial?.sessionId?sessions.filter(item=>item.sessionId===initial.sessionId):sessions;
 if(matches.length===1)return matches[0];
 if(initial?.startTime||initial?.sessionId)return undefined;
 const current=matches.filter(item=>sessionTimeLabel(item,now)==="Currently running");
 return current.length===1?current[0]:undefined;
}