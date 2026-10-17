"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { INDIAN_STATES } from "@/lib/constants";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type AddressFormValues = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
};

export function Field({
  id,
  label,
  error,
  children,
  hint,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-subtle-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

/** Shared address inputs for checkout and the address book. */
export function AddressFields<T extends AddressFormValues>({
  register,
  errors,
  prefix = "",
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  prefix?: string;
}) {
  const reg = register as unknown as UseFormRegister<AddressFormValues>;
  const err = errors as FieldErrors<AddressFormValues>;
  const a11y = (name: keyof AddressFormValues) => ({
    id: `${prefix}${name}`,
    "aria-invalid": Boolean(err[name]) || undefined,
    "aria-describedby": err[name] ? `${prefix}${name}-error` : undefined,
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${prefix}fullName`} label="Full name" error={err.fullName?.message}>
        <Input {...a11y("fullName")} autoComplete="name" {...reg("fullName")} />
      </Field>
      <Field id={`${prefix}phone`} label="Phone for delivery" error={err.phone?.message}>
        <Input {...a11y("phone")} type="tel" inputMode="tel" autoComplete="tel" {...reg("phone")} />
      </Field>
      <Field id={`${prefix}line1`} label="House / flat, street" error={err.line1?.message} className="sm:col-span-2">
        <Input {...a11y("line1")} autoComplete="address-line1" {...reg("line1")} />
      </Field>
      <Field id={`${prefix}line2`} label="Area / locality (optional)" error={err.line2?.message}>
        <Input {...a11y("line2")} autoComplete="address-line2" {...reg("line2")} />
      </Field>
      <Field id={`${prefix}landmark`} label="Landmark (optional)" error={err.landmark?.message}>
        <Input {...a11y("landmark")} placeholder="e.g. Near bus stand" {...reg("landmark")} />
      </Field>
      <Field id={`${prefix}city`} label="Town / city" error={err.city?.message}>
        <Input {...a11y("city")} autoComplete="address-level2" {...reg("city")} />
      </Field>
      <Field id={`${prefix}district`} label="District" error={err.district?.message}>
        <Input {...a11y("district")} {...reg("district")} />
      </Field>
      <Field id={`${prefix}state`} label="State" error={err.state?.message}>
        <NativeSelect {...a11y("state")} autoComplete="address-level1" {...reg("state")}>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field id={`${prefix}pincode`} label="PIN code" error={err.pincode?.message}>
        <Input {...a11y("pincode")} inputMode="numeric" autoComplete="postal-code" maxLength={6} className={cn("tabular-nums")} {...reg("pincode")} />
      </Field>
    </div>
  );
}
