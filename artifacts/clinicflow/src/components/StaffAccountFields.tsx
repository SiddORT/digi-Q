import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { EmailInput } from "@/components/EmailInput";
import { FormField } from "./FormField";
import { PhoneInput } from "./PhoneInput";
import { PasswordInput } from "./PasswordInput";
import { PASSWORD_RULE, required, validateEmail, validatePersonName, validatePhone } from "../lib/validators";
import { passwordPairError } from "../lib/staff-account";
import { Mail, Phone } from "lucide-react";

/** Passive status only: verification is completed by the staff member after sign-in. */
const NotVerified = ({ icon, testId }: { icon: "mail" | "phone"; testId: string }) => <span className="staff-verify" data-testid={testId}>{icon === "mail" ? <Mail size={16} aria-hidden /> : <Phone size={16} aria-hidden />}<span className="badge" role="status">Not verified</span></span>;

type Props = { control: Control<any>; register: UseFormRegister<any>; errors: FieldErrors<any>; getValues: (name: string) => unknown; withPassword: boolean };

/** Shared Add/Edit account fields. Password fields exist on create only. */
export function StaffAccountFields({ control, register, errors, getValues, withPassword }: Props) {
  const msg = (key: string) => errors[key]?.message as string | undefined;
  return <div className={withPassword ? "staff-account-fields is-create" : "staff-account-fields"}>
    <FormField id="input-fullName" label="Full Name" required error={msg("fullName")}><input autoComplete="off" {...register("fullName", { validate: (v: unknown) => required()(v) || validatePersonName(v) || true })} /></FormField>
    <FormField label="Email (used to sign in)" required error={msg("email")} status={withPassword ? <NotVerified icon="mail" testId="status-email-verification" /> : undefined}><EmailInput autoComplete="off" data-testid="input-user-email" {...register("email", { validate: (v: unknown) => required()(v) || validateEmail(v) || true })} /></FormField>
    <Controller name="mobile" control={control} rules={{ validate: (v: unknown) => (withPassword ? required()(v) : undefined) || validatePhone(v) || true }} render={({ field }) => <FormField className={withPassword ? "staff-account-mobile" : undefined} label="Mobile" required={withPassword} optional={!withPassword} error={msg("mobile")} status={withPassword ? <NotVerified icon="phone" testId="status-mobile-verification" /> : undefined}><PhoneInput {...field} value={field.value || ""} /></FormField>} />
    {withPassword && <>
      <FormField label="Password" required error={msg("password")}><PasswordInput autoComplete="new-password" data-testid="input-staff-password" {...register("password", { validate: (v: unknown) => passwordPairError(v, "x").password || true })} /></FormField>
      <FormField label="Confirm Password" required error={msg("confirmPassword")}><PasswordInput autoComplete="new-password" visibilityLabel="confirm password" data-testid="input-staff-confirm-password" {...register("confirmPassword", { validate: (v: unknown) => passwordPairError(getValues("password"), v).confirmPassword || true })} /></FormField>
      <small className="muted staff-password-help" data-testid="text-password-policy">{PASSWORD_RULE}</small>
    </>}
  </div>;
}
