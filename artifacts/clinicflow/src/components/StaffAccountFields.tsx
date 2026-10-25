import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { EmailInput } from "@/components/EmailInput";
import { FormField } from "./FormField";
import { PhoneInput } from "./PhoneInput";
import { PasswordInput } from "./PasswordInput";
import { required, validateEmail, validatePersonName, validatePhone } from "../lib/validators";
import { passwordPairError } from "../lib/staff-account";

type Props = { control: Control<any>; register: UseFormRegister<any>; errors: FieldErrors<any>; getValues: (name: string) => unknown; withPassword: boolean };

/** Shared Add/Edit account fields. Password fields exist on create only. */
export function StaffAccountFields({ control, register, errors, getValues, withPassword }: Props) {
  const msg = (key: string) => errors[key]?.message as string | undefined;
  return <>
    <FormField id="input-fullName" label="Full Name" required error={msg("fullName")}><input autoComplete="off" {...register("fullName", { validate: (v: unknown) => required()(v) || validatePersonName(v) || true })} /></FormField>
    <FormField label="Email (used to sign in)" required error={msg("email")}><EmailInput autoComplete="off" data-testid="input-user-email" {...register("email", { validate: (v: unknown) => required()(v) || validateEmail(v) || true })} /></FormField>
    <Controller name="mobile" control={control} rules={{ validate: (v: unknown) => (withPassword ? required()(v) : undefined) || validatePhone(v) || true }} render={({ field }) => <FormField label="Mobile" required={withPassword} optional={!withPassword} error={msg("mobile")}><PhoneInput {...field} value={field.value || ""} /></FormField>} />
    {withPassword && <>
      <FormField label="Password" required error={msg("password")}><PasswordInput showChecklist autoComplete="new-password" data-testid="input-staff-password" {...register("password", { validate: (v: unknown) => passwordPairError(v, "x").password || true })} /></FormField>
      <FormField label="Confirm Password" required error={msg("confirmPassword")}><PasswordInput autoComplete="new-password" visibilityLabel="confirm password" data-testid="input-staff-confirm-password" {...register("confirmPassword", { validate: (v: unknown) => passwordPairError(getValues("password"), v).confirmPassword || true })} /></FormField>
    </>}
  </>;
}
