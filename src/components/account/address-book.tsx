"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { normalizePhone } from "@/lib/phone";
import type { AddressDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/primitives";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AddressFields, Field } from "@/components/checkout/address-fields";

const schema = z.object({
  label: z.string().trim().max(40),
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  phone: z.string().trim().refine((v) => Boolean(normalizePhone(v)), "Enter a valid 10-digit mobile number"),
  line1: z.string().trim().min(3, "Please enter your house / street").max(200),
  line2: z.string().trim().max(200),
  landmark: z.string().trim().max(120),
  city: z.string().trim().min(2, "Town / city is required").max(80),
  district: z.string().trim().min(2, "District is required").max(80),
  state: z.string().trim().min(2, "State is required"),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
  isDefault: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function AddressBook({ initial, defaultName, defaultPhone }: { initial: AddressDTO[]; defaultName: string; defaultPhone: string }) {
  const [addresses, setAddresses] = React.useState(initial);
  const [editing, setEditing] = React.useState<AddressDTO | "new" | null>(null);
  const [saving, setSaving] = React.useState(false);
  const blank: Values = { label: "Home", fullName: defaultName, phone: defaultPhone.replace(/^\+91/, ""), line1: "", line2: "", landmark: "", city: "Palani", district: "Dindigul", state: "Tamil Nadu", pincode: "", isDefault: addresses.length === 0 };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: blank });

  function open(a: AddressDTO | "new") {
    setEditing(a);
    form.reset(a === "new" ? blank : { ...a, phone: a.phone.replace(/^\+91/, "") });
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const res =
        editing && editing !== "new"
          ? await apiFetch<{ addresses: AddressDTO[] }>(`/api/account/addresses/${editing.id}`, { method: "PATCH", body: values })
          : await apiFetch<{ addresses: AddressDTO[] }>("/api/account/addresses", { body: values });
      setAddresses(res.addresses);
      setEditing(null);
      toast.success("Address saved");
    } catch (err) {
      if (err instanceof ApiError) for (const [k, m] of Object.entries(err.fieldErrors)) form.setError(k as keyof Values, { message: m });
      toast.error(err instanceof Error ? err.message : "Couldn't save address");
    } finally {
      setSaving(false);
    }
  });

  async function remove(a: AddressDTO) {
    if (!confirm(`Delete the address “${a.label}”?`)) return;
    try {
      const res = await apiFetch<{ addresses: AddressDTO[] }>(`/api/account/addresses/${a.id}`, { method: "DELETE" });
      setAddresses(res.addresses);
      toast.success("Address deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete address");
    }
  }

  async function makeDefault(a: AddressDTO) {
    try {
      const res = await apiFetch<{ addresses: AddressDTO[] }>(`/api/account/addresses/${a.id}`, { method: "PATCH", body: { ...a, isDefault: true } });
      setAddresses(res.addresses);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update");
    }
  }

  return (
    <div className="mt-6">
      {addresses.length === 0 ? (
        <Card>
          <EmptyState icon={MapPin} title="No saved addresses" description="Add an address to check out faster next time." action={<Button onClick={() => open("new")}><Plus /> Add address</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <Card key={a.id} className="flex flex-col p-5">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <p className="font-semibold">{a.label}</p>
                  {a.isDefault && <Badge tone="primary">Default</Badge>}
                </div>
                <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-muted-foreground">
                  {a.fullName}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />
                  {a.landmark && <>Landmark: {a.landmark}<br /></>}
                  {a.city}, {a.district}, {a.state} – {a.pincode}<br />{a.phone}
                </address>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => open(a)}><Pencil /> Edit</Button>
                  {!a.isDefault && <Button size="sm" variant="ghost" onClick={() => makeDefault(a)}><Star /> Make default</Button>}
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(a)}><Trash2 /> Delete</Button>
                </div>
              </Card>
            ))}
          </div>
          {addresses.length < 10 && <Button className="mt-5" variant="outline" onClick={() => open("new")}><Plus /> Add another address</Button>}
        </>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add address" : "Edit address"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate>
            <Field id="addr-label" label="Label" error={form.formState.errors.label?.message} className="mb-4 max-w-xs">
              <Input id="addr-label" placeholder="Home, Office…" {...form.register("label")} />
            </Field>
            <AddressFields register={form.register} errors={form.formState.errors} prefix="addr-" />
            <label className="mt-4 flex items-center gap-2.5 text-sm">
              <Checkbox checked={form.watch("isDefault")} onCheckedChange={(v) => form.setValue("isDefault", v === true)} />
              Use as default address
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>Save address</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
