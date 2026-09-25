export function doctorWorkspaceScope(identity: {user?: {role: string} | null; doctorId?: string | null}) {
 const isDoctor=identity.user?.role==="doctor";
 return {isDoctor,doctorId:isDoctor?identity.doctorId||"":""};
}

type SessionIdentity={sessionId?:string|null;startTime?:string|null};
export function sessionContextKey(session:SessionIdentity){
 return JSON.stringify([session.sessionId||"",session.startTime||""]);
}
export function resolveSessionContext<T extends SessionIdentity>(sessions:T[],initial?:SessionIdentity){
 const matches=initial?.startTime?sessions.filter(item=>item.startTime===initial.startTime&&(!initial.sessionId||item.sessionId===initial.sessionId)):initial?.sessionId?sessions.filter(item=>item.sessionId===initial.sessionId):sessions;
 return matches.length===1?matches[0]:undefined;
}