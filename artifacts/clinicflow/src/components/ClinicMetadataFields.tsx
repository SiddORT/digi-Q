import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { FormField } from "./FormField";
import { useMemo } from "react";

type Option = { id: string; name: string };
export type ClinicMetadataValue = { categoryId?: string | null; customCategory?: string | null; specialityIds?: string[]; customSpecialities?: string[] };
type Props = {
  value: ClinicMetadataValue;
  onChange: (patch: ClinicMetadataValue) => void;
  categories?: Option[]; specialities?: Option[];
  loading?: boolean; error?: boolean; onRetry?: () => void;
  saved?: ClinicMetadataValue & { categoryName?: string | null; specialityNames?: string[] };
};

/** Only clinic metadata permits clinic-owned custom vocabulary. Doctor pickers stay independent. */
export function ClinicMetadataFields(props: Props) {
  const { value, onChange, saved } = props;
  const supplied = props.categories !== undefined;
  const lookup = api.useGetRegistrationOptions({ query: { queryKey: api.getGetRegistrationOptionsQueryKey(), enabled: !supplied, retry: false } });
  const categories = props.categories ?? lookup.data?.categories ?? [];
  const specialities = props.specialities ?? lookup.data?.specialities ?? [];
  const loading = props.loading ?? lookup.isFetching;
  const error = props.error ?? !!lookup.error;
  const retry = props.onRetry ?? (() => { void lookup.refetch(); });
  const categoryOptions = useMemo(() => {
    const options = categories.map(o => ({ value: o.id, label: o.name, disabled: false }));
    if (saved?.categoryId && value.categoryId === saved.categoryId && !options.some(o => o.value === saved.categoryId))
      options.push({ value: saved.categoryId, label: saved.categoryName || "Saved category unavailable", disabled: true });
    // Custom entry is available on the first page, regardless of catalog size.
    options.unshift({ value: "__custom_category", label: "Other — type your own category", disabled: false });
    return options;
  }, [categories, saved, value.categoryId]);
  const specialityOptions = useMemo(() => {
    const options = specialities.map(o => ({ value: o.id, label: o.name, disabled: false }));
    for (const [index, id] of (saved?.specialityIds || []).entries()) if ((value.specialityIds || []).includes(id) && !options.some(o => o.value === id))
      options.push({ value: id, label: saved?.specialityNames?.[index] || "Saved speciality unavailable", disabled: true });
    return options;
  }, [specialities, saved, value.specialityIds]);
  const custom = value.customSpecialities || [];
  const standard = value.specialityIds || [];
  // Empty text is a deliberate draft-only Other mode. Null/omitted means no
  // custom category, so parent reset/discard also resets this control.
  const other = value.customCategory !== undefined && value.customCategory !== null;
  return <div className="wide" data-testid="clinic-metadata-fields">
    <SearchableSelect label="Category (optional)" value={other ? "__custom_category" : value.categoryId || ""}
      localPageSize={75}
      options={categoryOptions}
      loading={loading} onChange={id => onChange({ categoryId: id === "__custom_category" ? null : id || null, customCategory: id === "__custom_category" ? "" : null })}/>
    {other && <FormField label="Custom category" required helper="Saved only for this clinic, not added to the shared catalog.">
      <input value={value.customCategory || ""} required maxLength={100} data-testid="clinic-custom-category" onChange={e => onChange({ categoryId: null, customCategory: e.target.value })}/>
    </FormField>}
    {other && <button type="button" className="text-link" onClick={() => onChange({ categoryId: null, customCategory: null })}>Remove custom category</button>}
    <SearchableMultiSelect localPageSize={75} label="Specialities (optional)" value={standard} options={specialityOptions} loading={loading} onChange={ids => onChange({ specialityIds: ids })}/>
    {custom.map((text, index) => <div key={index} className="flex min-w-0 items-end gap-2">
      <FormField label={`Custom speciality ${index + 1}`} required><input required maxLength={100} value={text} data-testid={`clinic-custom-speciality-${index}`} onChange={e => onChange({ customSpecialities: custom.map((item, i) => i === index ? e.target.value : item) })}/></FormField>
      <button type="button" className="button secondary small" aria-label={`Remove custom speciality ${index + 1}`} onClick={() => onChange({ customSpecialities: custom.filter((_, i) => i !== index) })}>Remove</button>
    </div>)}
    <button type="button" className="text-link" disabled={standard.length + custom.length >= 30} onClick={() => onChange({ customSpecialities: [...custom, ""] })}>Add custom speciality</button>
    {loading && <p role="status">Loading healthcare suggestions… Custom clinic entry remains available.</p>}
    {error ? <p role="alert">Healthcare suggestions could not be loaded. Your selections are retained; you can still enter custom clinic values. <button type="button" onClick={retry}>Retry healthcare suggestions</button></p>
      : !loading && (!categories.length || !specialities.length) && <p role="status">{!categories.length ? "No standard categories are available. " : ""}{!specialities.length ? "No standard specialities are available. " : ""}Use custom clinic entry or retry. <button type="button" onClick={retry}>Refresh healthcare suggestions</button></p>}
    <p className="muted">Clinic descriptions only, not qualifications or accreditation. These do not change doctor specialization or booking eligibility. Up to 30 specialities.</p>
  </div>;
}

export function ClinicMetadataFacts({ clinic }: { clinic: { categoryName?: string | null; specialityNames?: string[] } }) {
  return <><div><dt>Category</dt><dd>{clinic.categoryName || "Not set"}</dd></div><div><dt>Specialities</dt><dd>{clinic.specialityNames?.join(", ") || "Not set"}</dd></div></>;
}
