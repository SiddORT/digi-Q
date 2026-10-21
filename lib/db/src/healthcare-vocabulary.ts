import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

/** Additive system suggestions. Existing operator names, IDs and inactive decisions win. */
export const healthcareVocabulary = {
  clinicCategory: [
    ["generalPractice", "General Practice", "general"],
    ["singleSpecialityClinic", "Single-speciality Clinic", "specialist", "singleSpecialtyClinic"],
    ["multispecialityClinic", "Multispeciality Clinic", "multispecialtyClinic"],
    ["dentalClinic", "Dental Clinic"], ["eyeClinic", "Eye Clinic"],
    ["physiotherapyRehabilitationCentre", "Physiotherapy & Rehabilitation Centre", "physiotherapyRehabilitationCenter"],
    ["diagnosticCentre", "Diagnostic Centre", "diagnosticCenter"], ["mentalHealthCentre", "Mental Health Centre", "mentalHealthCenter"],
    ["ayushClinic", "AYUSH Clinic"], ["hospital", "Hospital"],
  ],
  specialization: [
    ["generalMedicine", "General Medicine"], ["familyMedicine", "Family Medicine"],
    ["paediatrics", "Paediatrics", "pediatrics"], ["obstetricsGynaecology", "Obstetrics & Gynaecology", "obstetricsGynecology"],
    ["dermatology", "Dermatology"], ["orthopaedics", "Orthopaedics", "orthopedics"],
    ["cardiology", "Cardiology"], ["ent", "ENT", "earNoseThroat"],
    ["ophthalmology", "Ophthalmology"], ["dentistry", "Dentistry"], ["neurology", "Neurology"],
    ["gastroenterology", "Gastroenterology"], ["endocrinologyDiabetology", "Endocrinology & Diabetology"],
    ["pulmonology", "Pulmonology"], ["nephrology", "Nephrology"], ["urology", "Urology"],
    ["generalSurgery", "General Surgery"], ["psychiatry", "Psychiatry"],
    ["clinicalPsychology", "Clinical Psychology"], ["physiotherapy", "Physiotherapy"],
    ["nutritionDietetics", "Nutrition & Dietetics"], ["ayurveda", "Ayurveda"], ["homeopathy", "Homeopathy", "homoeopathy"],
  ],
};
const key = (value: string) => value.toLowerCase().replace(/\band\b|[^a-z0-9]/g, "");
export async function provisionHealthcareVocabulary(conn: { execute: (query: any) => Promise<any> }) {
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext('healthcare-vocabulary'))`);
  const { rows } = await conn.execute(sql`select category,code,data->>'name' as name from masters where category in ('clinicCategory','specialization')`);
  for (const [category, entries] of Object.entries(healthcareVocabulary)) {
    for (const [sortOrder, [code, name, ...aliases]] of entries.entries()) {
      const equivalent = new Set([code, name, ...aliases].map(key));
      if (rows.some((row: any) => row.category === category && (equivalent.has(key(row.code)) || equivalent.has(key(row.name || ""))))) continue;
      await conn.execute(sql`insert into masters(id,category,code,data) values(${randomUUID()},${category},${code},${JSON.stringify({ name, sortOrder })}::jsonb) on conflict(category,code) do nothing`);
    }
  }
}
