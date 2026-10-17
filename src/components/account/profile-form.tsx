"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { formatPhoneForDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Switch } from "@/components/ui/primitives";
import { Card } from "@/components/ui/display";
import { Field } from "@/components/checkout/address-fields";
import { useSession } from "@/components/providers/session-provider";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address").max(200)]),
  whatsappOrderUpdates: z.boolean(),
  marketingOptIn: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function ProfileForm({
  profile,
}: {
  profile: { name: string; email: string; phoneNumber: string; preferences: { whatsappOrderUpdates: boolean; marketingOptIn: boolean } };
}) {
  const router = useRouter();
  const { refresh } = useSession();
  const { register, handleSubmit, formState, setValue, watch, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: profile.name, email: profile.email, ...profile.preferences },
  });
  const [saving, setSaving] = React.useState(false);
  const v = watch();

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      await apiFetch("/api/account", {
        method: "PATCH",
        body: { name: values.name, email: values.email, preferences: { whatsappOrderUpdates: values.whatsappOrderUpdates, marketingOptIn: values.marketingOptIn } },
      });
      toast.success("Profile saved");
      await refresh();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [k, msg] of Object.entries(err.fieldErrors)) setError(k as keyof Values, { message: msg });
      }
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Full name" error={formState.errors.name?.message}>
            <Input id="name" autoComplete="name" aria-invalid={Boolean(formState.errors.name) || undefined} {...register("name")} />
          </Field>
          <Field id="phone" label="Mobile number" hint="Verified by OTP. Contact the store to change it.">
            <div id="phone" className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-muted px-3.5 text-[15px]">
              <CheckCircle2 className="size-4 text-success" /> {formatPhoneForDisplay(profile.phoneNumber)}
            </div>
          </Field>
          <Field id="email" label="Email (optional)" error={formState.errors.email?.message} className="sm:col-span-2">
            <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(formState.errors.email) || undefined} {...register("email")} />
          </Field>
        </div>
      </Card>
      <Card className="divide-y divide-border">
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <Label htmlFor="pref-wa" className="font-semibold">WhatsApp order updates</Label>
            <p className="mt-0.5 text-sm text-muted-foreground">Order confirmations and delivery status on WhatsApp. Transactional only.</p>
          </div>
          <Switch id="pref-wa" checked={v.whatsappOrderUpdates} onCheckedChange={(c) => setValue("whatsappOrderUpdates", c, { shouldDirty: true })} />
        </div>
        <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <Label htmlFor="pref-mkt" className="font-semibold">Offers &amp; promotions</Label>
            <p className="mt-0.5 text-sm text-muted-foreground">Occasional news about offers. Kept separate from order updates.</p>
          </div>
          <Switch id="pref-mkt" checked={v.marketingOptIn} onCheckedChange={(c) => setValue("marketingOptIn", c, { shouldDirty: true })} />
        </div>
      </Card>
      <Button type="submit" loading={saving}>Save changes</Button>
    </form>
  );
}
