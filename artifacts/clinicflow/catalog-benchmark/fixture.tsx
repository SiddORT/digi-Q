import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClinicMetadataFields, type ClinicMetadataValue } from "../src/components/ClinicMetadataFields";
import "./fixture.css";
import { SearchableSelect } from "../src/components/SearchableSelect";
import { SearchableMultiSelect } from "../src/components/SearchableMultiSelect";
import * as api from "@workspace/api-client-react";

function Fixture() {
  const historical = new URLSearchParams(location.search).has("saved");
  const saved = historical ? { categoryId: "historical-category", categoryName: "Historical category",
    specialityIds: ["historical-speciality"], specialityNames: ["Historical speciality"] } : undefined;
  const [value, setValue] = useState<ClinicMetadataValue>(saved || {});
  const [specialization, setSpecialization] = useState("");
  const [qualifications, setQualifications] = useState<string[]>([]);
  const references = api.useGetRegistrationOptions();
  return <main style={{ maxWidth: 700, padding: 20, margin: "auto" }}>
    <h1>Fictional catalog benchmark</h1>
    <ClinicMetadataFields value={value} saved={saved} onChange={patch => setValue(old => ({ ...old, ...patch }))}/>
    <SearchableSelect localPageSize={75} label="Doctor specialization" value={specialization} onChange={setSpecialization}
      options={(references.data?.specialities || []).map(o => ({ value: o.id, label: o.name }))}/>
    <SearchableMultiSelect localPageSize={75} label="Doctor qualifications" value={qualifications} onChange={setQualifications}
      options={(references.data?.qualifications || []).map(o => ({ value: o.id, label: o.name }))}/>
    <output data-testid="draft">{JSON.stringify(value)}</output>
    <output data-testid="doctor">{JSON.stringify({ specialization, qualifications })}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Fixture/></QueryClientProvider>
);
