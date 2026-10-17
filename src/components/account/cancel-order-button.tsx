"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CancelOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function cancel() {
    setLoading(true);
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { body: { reason } });
      toast.success("Your order has been cancelled");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel the order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger-outline">Cancel order</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {orderNumber}?</DialogTitle>
          <DialogDescription>This can&apos;t be undone. Items will be released back to the store.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="cancel-reason">Reason (optional)</Label>
        <Textarea id="cancel-reason" className="mt-1.5" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Keep order</Button>
          <Button variant="danger" onClick={cancel} loading={loading}>Cancel order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
