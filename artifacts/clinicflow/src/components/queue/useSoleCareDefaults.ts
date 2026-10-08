import { useEffect } from "react";
import * as api from "@workspace/api-client-react";
import { soleAssigned } from "../../lib/sole-option";

// Only auto-select an actual sole result from the authorized scope, never the
// first item of a paginated list. Public booking stays fixed to its QR context.
export function useSoleCareDefaults({enabled,clinicId,branchId,doctorId,setClinic,setBranch,setDoctor}:{enabled:boolean;clinicId:string;branchId:string;doctorId:string;setClinic:(id:string)=>void;setBranch:(id:string)=>void;setDoctor:(id:string)=>void}) {
  const cp={status:"active" as const,page:1,pageSize:2,doctorId:doctorId||undefined};
  const clinics=api.useListClinics(cp,{query:{queryKey:api.getListClinicsQueryKey(cp),enabled:enabled&&!clinicId}});
  const bp={...cp,clinicId};
  const branches=api.useListBranches(bp,{query:{queryKey:api.getListBranchesQueryKey(bp),enabled:enabled&&!!clinicId&&!branchId}});
  const dp={...bp,branchId};
  const doctors=api.useListDoctors(dp,{query:{queryKey:api.getListDoctorsQueryKey(dp),enabled:enabled&&!!clinicId&&!!branchId&&!doctorId}});
  useEffect(()=>{const sole=soleAssigned(clinics.data,!!clinics.error||clinics.isFetching);if(enabled&&!clinicId&&sole)setClinic(sole.id);},[enabled,clinicId,clinics.data,clinics.error,clinics.isFetching]);
  useEffect(()=>{const sole=soleAssigned(branches.data,!!branches.error||branches.isFetching);if(enabled&&clinicId&&!branchId&&sole)setBranch(sole.id);},[enabled,clinicId,branchId,branches.data,branches.error,branches.isFetching]);
  useEffect(()=>{const sole=soleAssigned(doctors.data,!!doctors.error||doctors.isFetching);if(enabled&&clinicId&&branchId&&!doctorId&&sole)setDoctor(sole.id);},[enabled,clinicId,branchId,doctorId,doctors.data,doctors.error,doctors.isFetching]);
}