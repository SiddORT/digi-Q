// Called only by the explicitly opted-in disposable browser server.
// All records and credentials are fictional, and delivery remains disabled.
export async function seedMovementBrowser(h, password) {
  const today = new Date().toISOString().slice(0, 10);
  await h.pg.exec(`
    delete from appointment_history; delete from appointments;
    update branches set data=data || '{"timezone":"UTC","address":"Fictional development location"}'::jsonb where id='b1';
    update patients set mobile='+15555550101', mobile_verified=true where id='p1';
    insert into settings(id,data) values('platform','{"notificationsEnabled":false,"cancellationCutoffMinutes":0,"bookingHorizonDays":60}')
      on conflict(id) do update set data=excluded.data;
    insert into qrs(id,clinic_id,branch_id,doctor_id,public_reference) values('movement-qr','c1','b1','d1','movement-fixture');
  `);
  for (let day = 0; day < 7; day++) await h.pg.query(`insert into schedules(id,doctor_id,clinic_id,branch_id,day_of_week,data)
    values($1,'d1','c1','b1',$2,$3)`, ["movement-"+day,day,JSON.stringify({isOpen:true,startTime:"00:00",endTime:"23:59",
      timezone:"UTC",maxTokens:30,tokenPrefix:"M",consultationMinutes:10,queueMode:"mixed"})]);
  const login = await h.call(null, "POST", "/auth/login", {email:"rec@test.invalid",password});
  if (login.status !== 200) throw new Error("Fictional receptionist could not sign in");
  const cookie = [...new Map(login.headers.getSetCookie().map(v=>v.split(";")[0]).map(v=>[v.split("=")[0],v])).values()].join("; ");
  const appointments = [];
  for(let i=1;i<=6;i++) {
    const patientId=i===1?"p1":"movement-p"+i;
    if(i>1)await h.pg.query(`insert into patients(id,clinic_id,branch_id,data) values($1,'c1','b1',$2)`,
      [patientId,JSON.stringify({fullName:"Fictional Movement Patient "+i,code:"MOVE-"+i})]);
    const response=await h.call(null,"POST","/appointments",{patientId,clinicId:"c1",branchId:"b1",doctorId:"d1",date:today,
      source:"phone",sessionId:"movement-"+new Date(today+"T12:00:00Z").getUTCDay()},{cookie});
    if(response.status!==201)throw new Error("Disposable movement booking failed: "+response.status);
    appointments.push(response.data.id);
  }
  return {today,appointments,qrReference:"movement-fixture"};
}
