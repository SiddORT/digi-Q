import { useEffect } from "react";
import * as api from "@workspace/api-client-react";

// Only auto-select an actual sole result from the authorized scope, never the
// first item of a paginated list. Public booking stays fixed to its QR context.
export function useSoleCareDefaults({enabled,clinicId,branchId,doctorId,setClinic,setBranch,setDoctor}:{enabled:boolean;clinicId:string;branchId:string;doctorId:string;setClinic:(id:string)=>void;setBranch:(id:string)=>void;setDoctor:(id:string)=>void}) {
  const cp={status:"active" as const,page:1,pageSize:2};
  const clinics=api.useListClinics(cp,{query:{queryKey:api.getListClinicsQueryKey(cp),enabled:enabled&&!clinicId}});
  const bp={...cp,clinicId};
  const branches=api.useListBranches(bp,{query:{queryKey:api.getListBranchesQueryKey(bp),enabled:enabled&&!!clinicId&&!branchId}});
  const dp={...bp,branchId};
  const doctors=api.useListDoctors(dp,{query:{queryKey:api.getListDoctorsQueryKey(dp),enabled:enabled&&!!clinicId&&!!branchId&&!doctorId}});
  useEffect(()=>{if(enabled&&!clinicId&&!clinics.error&&clinics.data?.total===1)setClinic(clinics.data.items[0].id);},[enabled,clinicId,clinics.data,clinics.error]);
  useEffect(()=>{if(enabled&&clinicId&&!branchId&&!branches.error&&branches.data?.total===1)setBranch(branches.data.items[0].id);},[enabled,clinicId,branchId,branches.data,branches.error]);
  useEffect(()=>{if(enabled&&clinicId&&branchId&&!doctorId&&!doctors.error&&doctors.data?.total===1)setDoctor(doctors.data.items[0].id);},[enabled,clinicId,branchId,doctorId,doctors.data,doctors.error]);
}