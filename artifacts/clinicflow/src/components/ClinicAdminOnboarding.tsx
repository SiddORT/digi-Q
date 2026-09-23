import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { onboardClinicAdmin } from "@workspace/api-client-react";
import { Plus, X } from "lucide-react";
import { AppDialog } from "./AppDialog";

type SetupFields = {
  fullName: string;
  email: string;
  mobile: string;
  name: string;
  address: string;
  city: string;
  phone: string;
};

export function ClinicAdminOnboarding() {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const locked = useRef(false);
  const client = useQueryClient();
  const form = useForm<SetupFields>();
  const setup = useMutation({
    onSettled: () => { locked.current = false; },
    mutationFn: (values: SetupFields) => onboardClinicAdmin({
      admin: {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}),
      },
      clinic: {
        name: values.name.trim(),
        address: values.address.trim(),
        ...(values.city.trim() ? { city: values.city.trim() } : {}),
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      },
    }),
    onSuccess: (_result, values) => {
      setSuccess(`${values.fullName} now manages ${values.name}. Clinic access has been saved.`);
      setOpen(false);
      form.reset();
      client.invalidateQueries();
    },
  });
  const input = (key: keyof SetupFields, label: string, required = false, type = "text") => (
    <label key={key}>
      {label}{required && <span className="required"> *</span>}
      <input type={type} data-testid={`onboarding-${key}`} {...form.register(key, {
        required,
        validate: value => !required || !!value?.trim(),
      })} />
      {form.formState.errors[key] && <small className="field-error">Please complete this field.</small>}
    </label>
  );
  return (
    <section className="panel padded" style={{ marginBottom: 20 }}>
      <h3>Clinic Admin setup</h3>
      <p className="muted">Create a Clinic Admin and their first clinic together. Existing clinics and their owners are not changed.</p>
      <button className="button small" data-testid="button-setup-clinic-admin" onClick={() => {
        form.reset(); setup.reset(); setSuccess(""); setOpen(true);
      }}><Plus size={17} /> Set up Clinic Admin</button>
      {success && <p className="notice" role="status" data-testid="onboarding-success">{success}</p>}
      {open && <AppDialog open onClose={() => setOpen(false)} title="Set up Clinic Admin & first clinic" dirty={form.formState.isDirty} busy={setup.isPending}>
        <p className="notice">Both records are saved together. The new admin will be the clinic’s only Clinic Admin. No existing ownership will be transferred.</p>
        {setup.error && <div className="error-box" role="alert">{setup.error.message}</div>}
        <form className="form-grid" onSubmit={form.handleSubmit(values => { if (!setup.isPending && !locked.current) { locked.current = true; setup.mutate(values); } })}>
          <h3 className="wide">Administrator</h3>
          {input("fullName", "Full name", true)}
          {input("email", "Admin email", true, "email")}
          {input("mobile", "Admin mobile", false, "tel")}
          <h3 className="wide">New clinic</h3>
          {input("name", "Clinic name", true)}
          {input("address", "Address", true)}
          {input("city", "City")}
          {input("phone", "Clinic phone", false, "tel")}
          <div className="wide form-footer">
            <button className="button" disabled={setup.isPending} data-testid="button-submit-clinic-admin">
              {setup.isPending ? "Creating admin and clinic…" : "Create admin & clinic"}
            </button>
          </div>
        </form>
      </AppDialog>}
    </section>
  );
}