import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { publicCareOptions } from "../../lib/directory-cache";
import { soleAssigned } from "../../lib/sole-option";
import { useDirectoryCardinality, useDirectoryActor } from "../../lib/use-directory";

// Only auto-select an actual sole result from the authorized scope, never the
// first item of a paginated list. Patients use public authority; QR contexts stay fixed.
export function useSoleCareDefaults({enabled,publicMode=false,clinicId,branchId,doctorId,setClinic,setBranch,setDoctor}:{enabled:boolean;publicMode?:boolean;clinicId:string;branchId:string;doctorId:string;setClinic:(id:string)=>void;setBranch:(id:string)=>void;setDoctor:(id:string)=>void}) {
  const actor=useDirectoryActor();
  const cp={status:"active" as const,doctorId:doctorId||undefined};
  const staffClinics=useDirectoryCardinality("clinics",cp,enabled&&!publicMode&&!clinicId);
  const bp={...cp,clinicId};
  const staffBranches=useDirectoryCardinality("branches",bp,enabled&&!publicMode&&!!clinicId&&!branchId);
  const dp={...bp,branchId};
  const staffDoctors=useDirectoryCardinality("doctors",dp,enabled&&!publicMode&&!!clinicId&&!!branchId&&!doctorId);
  const publicClinics=useInfiniteQuery({...publicCareOptions(actor,"clinics",cp,(p,s)=>api.listPublicClinics(p,{signal:s})),enabled:enabled&&publicMode&&!clinicId});
  const publicBranches=useInfiniteQuery({...publicCareOptions(actor,"branches",bp,(p,s)=>api.listPublicBranches(p,{signal:s})),enabled:enabled&&publicMode&&!!clinicId&&!branchId});
  const publicDoctors=useInfiniteQuery({...publicCareOptions(actor,"doctors",dp,(p,s)=>api.listPublicDoctors(p,{signal:s})),enabled:enabled&&publicMode&&!!clinicId&&!!branchId&&!doctorId});
  const clinics=publicMode?{...publicClinics,data:publicClinics.data?.pages[0]}:staffClinics;
  const branches=publicMode?{...publicBranches,data:publicBranches.data?.pages[0]}:staffBranches;
  const doctors=publicMode?{...publicDoctors,data:publicDoctors.data?.pages[0]}:staffDoctors;
  useEffect(()=>{const sole=soleAssigned(clinics.data,!!clinics.error||clinics.isFetching);if(enabled&&!clinicId&&sole)setClinic(sole.id);},[enabled,clinicId,clinics.data,clinics.error,clinics.isFetching]);
  useEffect(()=>{const sole=soleAssigned(branches.data,!!branches.error||branches.isFetching);if(enabled&&clinicId&&!branchId&&sole)setBranch(sole.id);},[enabled,clinicId,branchId,branches.data,branches.error,branches.isFetching]);
  useEffect(()=>{const sole=soleAssigned(doctors.data,!!doctors.error||doctors.isFetching);if(enabled&&clinicId&&branchId&&!doctorId&&sole)setDoctor(sole.id);},[enabled,clinicId,branchId,doctorId,doctors.data,doctors.error,doctors.isFetching]);
}