"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, TicketPercent, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { formatDate, formatINR, toRupees } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/primitives";
import { Badge, EmptyState } from "@/components/ui/display";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/checkout/address-fields";
import { Table, TableCard, Td, Th } from "./ui";

export type CouponRow = {
  id: string;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minimumOrderValue: number;
  maximumDiscount: number | null;
  startDate: string | null;
  expiryDate: string | null;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  status: "active" | "inactive";
};

type Draft = { id?: string; code: string; description: string; discountType: "percent" | "fixed"; discountValue: string; minimumOrderValue: string; maximumDiscount: string; startDate: string; expiryDate: string; usageLimit: string; perCustomerLimit: string; status: "active" | "inactive" };

const blank: Draft = { code: "", description: "", discountType: "percent", discountValue: "", minimumOrderValue: "", maximumDiscount: "", startDate: "", expiryDate: "", usageLimit: "", perCustomerLimit: "1", status: "active" };
const dateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function describe(c: CouponRow) {
  const v = c.discountType === "percent" ? `${c.discountValue}% off` : `${formatINR(c.discountValue)} off`;
  return `${v}${c.maximumDiscount ? ` (max ${formatINR(c.maximumDiscount)})` : ""}${c.minimumOrderValue ? ` · min ${formatINR(c.minimumOrderValue)}` : ""}`;
}

export function CouponManager({ initial }: { initial: CouponRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  function edit(c: CouponRow) {
    setErrors({});
    setDraft({
      id: c.id,
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      discountValue: String(c.discountType === "fixed" ? toRupees(c.discountValue) : c.discountValue),
      minimumOrderValue: c.minimumOrderValue ? String(toRupees(c.minimumOrderValue)) : "",
      maximumDiscount: c.maximumDiscount ? String(toRupees(c.maximumDiscount)) : "",
      startDate: dateInput(c.startDate),
      expiryDate: dateInput(c.expiryDate),
      usageLimit: c.usageLimit ? String(c.usageLimit) : "",
      perCustomerLimit: c.perCustomerLimit !== null ? String(c.perCustomerLimit) : "",
      status: c.status,
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErrors({});
    const body = {
      ...draft,
      startDate: draft.startDate ? `${draft.startDate}T00:00:00+05:30` : "",
      expiryDate: draft.expiryDate ? `${draft.expiryDate}T23:59:59+05:30` : "",
    };
    try {
      if (draft.id) await apiFetch(`/api/admin/coupons/${draft.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/coupons", { body });
      toast.success("Coupon saved");
      setDraft(null);
      router.refresh();
    } catch (e) {
      const ae = e as ApiError;
      setErrors({ ...ae.fieldErrors, ...(ae.details?.field ? { [String(ae.details.field)]: ae.message } : {}) });
      toast.error(ae.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CouponRow) {
    if (!confirm(c.usedCount ? `“${c.code}” has been used, so it will be deactivated instead of deleted. Continue?` : `Delete coupon “${c.code}”?`)) return;
    try {
      await apiFetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      toast.success(c.usedCount ? "Coupon deactivated" : "Coupon deleted");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => (d ? { ...d, [k]: k === "code" ? e.target.value.toUpperCase() : e.target.value } : d));
  const now = Date.now();

  return (
    <div>
      <Button className="mb-4" onClick={() => { setErrors({}); setDraft(blank); }}><Plus /> New coupon</Button>
      <TableCard>
        {initial.length === 0 ? (
          <EmptyState icon={TicketPercent} title="No coupons yet" description="Create codes like WELCOME10 for new customers." />
        ) : (
          <Table>
            <thead><tr><Th>Code</Th><Th>Discount</Th><Th>Validity</Th><Th className="text-right">Used</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {initial.map((c) => {
                const expired = c.expiryDate && new Date(c.expiryDate).getTime() < now;
                return (
                  <tr key={c.id}>
                    <Td><span className="font-mono font-semibold">{c.code}</span>{c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}</Td>
                    <Td className="text-sm">{describe(c)}</Td>
                    <Td className="text-xs text-muted-foreground">{c.startDate ? formatDate(c.startDate) : "Now"} → {c.expiryDate ? formatDate(c.expiryDate) : "No expiry"}</Td>
                    <Td className="text-right tabular-nums">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</Td>
                    <Td>{expired ? <Badge tone="neutral">Expired</Badge> : <Badge tone={c.status === "active" ? "success" : "neutral"} className="capitalize">{c.status}</Badge>}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => edit(c)} aria-label={`Edit ${c.code}`}><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" className="text-danger" onClick={() => remove(c)} aria-label={`Delete ${c.code}`}><Trash2 /></Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </TableCard>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit coupon" : "New coupon"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cp-code" label="Code" error={errors.code}><Input id="cp-code" className="font-mono uppercase" value={draft.code} onChange={set("code")} /></Field>
              <Field id="cp-type" label="Type" error={errors.discountType}>
                <NativeSelect id="cp-type" value={draft.discountType} onChange={set("discountType")}>
                  <option value="percent">Percentage</option>
                  <option value="fixed">Fixed amount (₹)</option>
                </NativeSelect>
              </Field>
              <Field id="cp-desc" label="Description (shown to customers)" error={errors.description} className="sm:col-span-2"><Input id="cp-desc" value={draft.description} onChange={set("description")} /></Field>
              <Field id="cp-val" label={draft.discountType === "percent" ? "Discount (%)" : "Discount (₹)"} error={errors.discountValue}><Input id="cp-val" type="number" min="0" step="0.01" value={draft.discountValue} onChange={set("discountValue")} /></Field>
              {draft.discountType === "percent" && <Field id="cp-max" label="Maximum discount (₹)" error={errors.maximumDiscount}><Input id="cp-max" type="number" min="0" value={draft.maximumDiscount} onChange={set("maximumDiscount")} /></Field>}
              <Field id="cp-min" label="Minimum order (₹)" error={errors.minimumOrderValue}><Input id="cp-min" type="number" min="0" value={draft.minimumOrderValue} onChange={set("minimumOrderValue")} /></Field>
              <Field id="cp-start" label="Starts" error={errors.startDate}><Input id="cp-start" type="date" value={draft.startDate} onChange={set("startDate")} /></Field>
              <Field id="cp-end" label="Expires" error={errors.expiryDate}><Input id="cp-end" type="date" value={draft.expiryDate} onChange={set("expiryDate")} /></Field>
              <Field id="cp-limit" label="Total uses (blank = unlimited)" error={errors.usageLimit}><Input id="cp-limit" type="number" min="0" value={draft.usageLimit} onChange={set("usageLimit")} /></Field>
              <Field id="cp-per" label="Uses per customer (0 = unlimited)" error={errors.perCustomerLimit}><Input id="cp-per" type="number" min="0" value={draft.perCustomerLimit} onChange={set("perCustomerLimit")} /></Field>
              <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
                <Switch checked={draft.status === "active"} onCheckedChange={(c) => setDraft({ ...draft, status: c ? "active" : "inactive" })} /> Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save coupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
