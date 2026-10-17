"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client-api";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus, type PaymentMethod, type PaymentStatus } from "@/lib/constants";
import { formatDateTime, toRupees } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/checkout/address-fields";

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  processing: "Start processing",
  packed: "Mark packed",
  shipped: "Mark shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  returned: "Mark returned",
  refunded: "Record refund",
};

export function OrderActions({
  orderId,
  status,
  paymentMethod,
  paymentStatus,
  totalAmount,
  allowed,
  canUpdate,
  canCancel,
  canRefund,
  canOverride,
}: {
  orderId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  allowed: OrderStatus[];
  canUpdate: boolean;
  canCancel: boolean;
  canRefund: boolean;
  canOverride: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<{ status: OrderStatus; override: boolean } | null>(null);
  const [note, setNote] = React.useState("");
  const [refundAmount, setRefundAmount] = React.useState(String(toRupees(totalAmount)));
  const [refundRef, setRefundRef] = React.useState("");
  const [markPaid, setMarkPaid] = React.useState(true);
  const [overrideTo, setOverrideTo] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  if (!canUpdate) return <p className="text-sm text-muted-foreground">You can view this order but not change it.</p>;

  const visible = allowed.filter((s) => (s === "cancelled" ? canCancel : s === "refunded" ? canRefund && (paymentStatus === "paid" || paymentStatus === "partially_refunded") : true));

  async function submit() {
    if (!target) return;
    if ((target.status === "cancelled" || target.override) && !note.trim()) {
      toast.error("Please add a reason — it's recorded in the order timeline.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/orders/${orderId}/status`, {
        body: {
          status: target.status,
          note: note || undefined,
          override: target.override,
          ...(target.status === "refunded" ? { refundAmount: Number(refundAmount), refundReference: refundRef } : {}),
          ...(target.status === "delivered" && paymentMethod === "cod" ? { markPaid } : {}),
        },
      });
      toast.success(`Order ${ORDER_STATUS_LABELS[target.status].toLowerCase()}`);
      setTarget(null);
      setNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No further actions for a {ORDER_STATUS_LABELS[status].toLowerCase()} order.</p>
      ) : (
        <div className="grid gap-2">
          {visible.map((s) => (
            <Button key={s} variant={s === "cancelled" ? "danger-outline" : s === visible[0] ? "primary" : "outline"} onClick={() => setTarget({ status: s, override: false })}>
              {ACTION_LABELS[s] ?? ORDER_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      )}
      {canOverride && (
        <details className="rounded-[var(--radius-md)] border border-dashed border-border-strong p-3 text-sm">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-muted-foreground"><ShieldAlert className="size-4" /> Override status</summary>
          <p className="mt-2 text-xs text-muted-foreground">For corrections outside the normal workflow. Requires a reason and is recorded in the audit log.</p>
          <div className="mt-2 flex gap-2">
            <NativeSelect aria-label="Override to status" value={overrideTo} onChange={(e) => setOverrideTo(e.target.value)} className="h-9 text-sm">
              <option value="">Choose status…</option>
              {ORDER_STATUSES.filter((s) => s !== status && !allowed.includes(s)).map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
            </NativeSelect>
            <Button size="sm" variant="outline" disabled={!overrideTo} onClick={() => setTarget({ status: overrideTo as OrderStatus, override: true })}>Apply</Button>
          </div>
        </details>
      )}

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target && (ACTION_LABELS[target.status] ?? ORDER_STATUS_LABELS[target.status])}</DialogTitle>
            <DialogDescription>
              {target?.status === "cancelled" && "Stock will be returned to inventory and any coupon use released."}
              {target?.status === "returned" && "Returned items will be added back to inventory."}
              {target?.status === "delivered" && paymentMethod === "cod" && "Cash on delivery orders are normally marked paid when delivered."}
              {target?.override && " This is an override of the normal workflow."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {target?.status === "refunded" && (
              <>
                <Field id="refund-amt" label="Refund amount (₹)"><Input id="refund-amt" type="number" step="0.01" min="0" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} /></Field>
                <Field id="refund-ref" label="Reference (UPI / transaction id)"><Input id="refund-ref" value={refundRef} onChange={(e) => setRefundRef(e.target.value)} /></Field>
              </>
            )}
            {target?.status === "delivered" && paymentMethod === "cod" && (
              <label className="flex items-center gap-2.5 text-sm"><Checkbox checked={markPaid} onCheckedChange={(v) => setMarkPaid(v === true)} /> Cash collected — mark as paid</label>
            )}
            <Field id="status-note" label={target?.status === "cancelled" || target?.override ? "Reason (required)" : "Note (optional)"}>
              <Textarea id="status-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Back</Button>
            <Button variant={target?.status === "cancelled" ? "danger" : "primary"} onClick={submit} loading={saving}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OrderNotes({ orderId, notes, canWrite }: { orderId: string; notes: { id: string; note: string; adminName: string; at: string }[]; canWrite: boolean }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function add() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/orders/${orderId}/notes`, { body: { note: text } });
      setText("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add note");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3">
      {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet. Notes are visible to staff only.</p>}
      <ul className="space-y-2.5">
        {[...notes].reverse().map((n) => (
          <li key={n.id} className="rounded-[var(--radius-md)] bg-surface-muted p-3 text-sm">
            <p className="whitespace-pre-line">{n.note}</p>
            <p className="mt-1 text-xs text-subtle-foreground">{n.adminName} · {formatDateTime(n.at)}</p>
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="space-y-2">
          <Textarea aria-label="New internal note" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note for the team…" />
          <Button size="sm" variant="outline" onClick={add} loading={saving} disabled={!text.trim()}>Add note</Button>
        </div>
      )}
    </div>
  );
}

export function RetryNotificationButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await apiFetch<{ status: string; errorMessage: string | null }>(`/api/admin/notifications/${id}/retry`, { method: "POST", body: {} });
          if (r.status === "sent") toast.success("Accepted by WhatsApp — waiting for delivery confirmation");
          else toast.error(`Still failing: ${r.errorMessage ?? r.status}`);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Retry failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      <RotateCw /> Retry
    </Button>
  );
}
