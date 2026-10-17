"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display";
import { Field } from "@/components/checkout/address-fields";

export function CustomerAdminPanel({
  id,
  name,
  email,
  status,
  notes,
  canWrite,
  canSuspend,
  preferences,
}: {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  notes: { id: string; note: string; adminName: string; at: string }[];
  canWrite: boolean;
  canSuspend: boolean;
  preferences: { whatsapp: boolean; marketing: boolean };
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({ name, email });
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      await apiFetch(`/api/admin/customers/${id}`, { method: "PATCH", body });
      toast.success("Customer updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function addNote() {
    setBusy("note");
    try {
      await apiFetch(`/api/admin/customers/${id}/notes`, { body: { note } });
      setNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add note");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field id="c-name" label="Name"><Input id="c-name" value={form.name} disabled={!canWrite} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field id="c-email" label="Email"><Input id="c-email" type="email" value={form.email} disabled={!canWrite} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <p className="text-xs text-muted-foreground">Phone numbers are verified by OTP and can&apos;t be edited here.</p>
          <p className="text-xs text-muted-foreground">WhatsApp updates: {preferences.whatsapp ? "yes" : "no"} · Promotions: {preferences.marketing ? "yes" : "no"}</p>
          {canWrite && <Button size="sm" onClick={() => patch({ name: form.name, email: form.email }, "save")} loading={busy === "save"}>Save</Button>}
        </CardContent>
      </Card>
      {canSuspend && (
        <Card>
          <CardHeader><CardTitle>Account access</CardTitle></CardHeader>
          <CardContent>
            {status === "active" ? (
              <Button
                variant="danger-outline"
                className="w-full"
                loading={busy === "status"}
                onClick={() => confirm("Suspend this account? The customer will be signed out and can't place orders.") && patch({ accountStatus: "suspended" }, "status")}
              >
                <Ban /> Suspend account
              </Button>
            ) : (
              <Button className="w-full" loading={busy === "status"} onClick={() => patch({ accountStatus: "active" }, "status")}>
                <CheckCircle2 /> Reactivate account
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Internal notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes. Visible to staff only.</p>}
          {[...notes].reverse().map((n) => (
            <div key={n.id} className="rounded-[var(--radius-md)] bg-surface-muted p-3 text-sm">
              <p className="whitespace-pre-line">{n.note}</p>
              <p className="mt-1 text-xs text-subtle-foreground">{n.adminName} · {formatDateTime(n.at)}</p>
            </div>
          ))}
          {canWrite && (
            <>
              <Textarea aria-label="New note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
              <Button size="sm" variant="outline" disabled={!note.trim()} loading={busy === "note"} onClick={addNote}>Add note</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
