/** Presentation only: never decides eligibility or relaxes the booking guard. */
export function bookingContinueReason(state:{
  clinicId:string;branchId:string;doctorId:string;date:string;dateValid:boolean;
  today:string;lastDate?:string;detailsError:boolean;detailsLoading:boolean;
  membership:string;contextError:boolean;contextLoading:boolean;
  availabilityError:boolean;availabilityLoading:boolean;sessionCount:number;
  hasSession:boolean;sessionAvailable:boolean;remaining:number;stale:boolean;
  ready:boolean;sourceError:string|null;
}){
  if(!state.clinicId)return "Choose a clinic group to continue.";
  if(!state.branchId)return "Choose a location to continue.";
  if(!state.doctorId)return "Choose a doctor to continue.";
  if(!state.date||!state.dateValid)return "Enter a valid visit date to continue.";
  if(state.detailsError)return "Retry the selected clinic, location or doctor before continuing.";
  if(state.detailsLoading)return "Loading selected care details…";
  if(state.membership==="checking")return "Checking the doctor's location assignment…";
  if(state.membership!=="valid")return "Choose a doctor assigned to this location.";
  if(state.contextError||state.availabilityError)return "Retry availability before continuing.";
  if(state.contextLoading||state.availabilityLoading)return "Checking current sessions…";
  if(state.today&&state.date<state.today)return "Choose today or a later visit date.";
  if(state.lastDate&&state.date>state.lastDate)return "Choose a date within the clinic's booking window.";
  if(!state.ready||state.stale)return "Refresh availability before continuing.";
  if(!state.sessionCount)return "No sessions on this date. Choose another date or find the next available date.";
  if(!state.hasSession)return "Select a consulting session to continue.";
  if(!state.sessionAvailable||state.remaining<=0)return "This session is unavailable. Choose another session or date.";
  if(state.sourceError)return state.sourceError;
  return "Complete the visit details before continuing.";
}
