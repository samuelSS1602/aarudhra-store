"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/checkout/address-fields";

const TYPES = [
  { value: "restock", label: "Restock (received new stock)", sign: 1 },
  { value: "return", label: "Customer return (back to stock)", sign: 1 },
  { value: "damage", label: "Damaged / lost (remove)", sign: -1 },
  { value: "correction", label: "Stock-count correction (+/−)", sign: 0 },
  { value: "adjustment", label: "Other adjustment (+/−)", sign: 0 },
] as const;

export function AdjustStockButton({ productId, variantId, name, current }: { productId: string; variantId: string | null; name: string; current: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<(typeof TYPES)[number]["value"]>("restock");
  const [qty, setQty] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const meta = TYPES.find((t) => t.value === type)!;
  const n = parseInt(qty, 10);
  const change = Number.isNaN(n) ? 0 : meta.sign === 0 ? n : meta.sign * Math.abs(n);
  const after = current + change;

  async function submit() {
    setError(null);
    if (!change) return setError("Enter a quantity.");
    if (after < 0) return setError("Stock can't go below zero.");
    if (!reason.trim()) return setError("Please give a reason — it's kept in the stock history.");
    setSaving(true);
    try {
      await apiFetch("/api/admin/inventory/adjust", { body: { productId, variantId, adjustmentType: type, quantityChange: change, reason } });
      toast.success(`Stock updated: ${current} → ${after}`);
      setOpen(false);
      setQty("");
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Adjust</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>{name} · currently {current} in stock</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field id="adj-type" label="Type">
              <NativeSelect id="adj-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
            </Field>
            <Field id="adj-qty" label={meta.sign === 0 ? "Change (use − to remove)" : "Quantity"}>
              <Input id="adj-qty" type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field id="adj-reason" label="Reason">
              <Input id="adj-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier invoice #1234" />
            </Field>
            <p className="rounded-[var(--radius-md)] bg-surface-muted p-3 text-sm">
              New stock: <span className={after < 0 ? "font-semibold text-danger" : "font-semibold"}>{after}</span>
            </p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} loading={saving}>Save adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
