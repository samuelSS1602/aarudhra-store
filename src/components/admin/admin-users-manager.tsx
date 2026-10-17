"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { ROLE_LABELS, type StaffRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/checkout/address-fields";
import { Table, TableCard, Td, Th } from "./ui";

type Row = { id: string; name: string; email: string; role: StaffRole; status: "active" | "disabled"; lastLoginAt: string | null; locked: boolean };
const ROLES: StaffRole[] = ["owner", "admin", "manager", "staff"];

const ROLE_HELP: Record<StaffRole, string> = {
  owner: "Everything, including managing staff accounts.",
  admin: "Everything except staff accounts: refunds, overrides, cost prices, security settings, audit logs.",
  manager: "Products, inventory, coupons, cancellations, analytics, general settings.",
  staff: "Process orders and view products, customers and notifications.",
};

export function AdminUsersManager({ admins, meId }: { admins: Row[]; meId: string }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", role: "staff" as StaffRole, password: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [resetFor, setResetFor] = React.useState<Row | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function create() {
    setBusy(true);
    setErrors({});
    try {
      await apiFetch("/api/admin/admins", { body: form });
      toast.success("Staff account created");
      setCreating(false);
      setForm({ name: "", email: "", role: "staff", password: "" });
      router.refresh();
    } catch (e) {
      const ae = e as ApiError;
      setErrors(ae.fieldErrors ?? {});
      toast.error(ae.message);
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, body: Record<string, unknown>, msg: string) {
    try {
      await apiFetch(`/api/admin/admins/${id}`, { method: "PATCH", body });
      toast.success(msg);
      router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      return false;
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div>
        <Button className="mb-4" onClick={() => setCreating(true)}><Plus /> Add staff member</Button>
        <TableCard>
          <Table>
            <thead><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Last sign-in</Th><Th /></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <Td><p className="font-medium">{a.name} {a.id === meId && <Badge tone="primary">You</Badge>}</p><p className="text-xs text-muted-foreground">{a.email}</p></Td>
                  <Td>
                    <NativeSelect aria-label={`Role for ${a.name}`} value={a.role} disabled={a.id === meId} onChange={(e) => void update(a.id, { role: e.target.value }, "Role updated — their sessions were signed out")} className="h-9 w-auto text-sm">
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </NativeSelect>
                  </Td>
                  <Td>
                    <Badge tone={a.status === "active" ? "success" : "neutral"} className="capitalize">{a.status}</Badge>
                    {a.locked && <Badge tone="warning" className="ml-1">Locked</Badge>}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never"}</Td>
                  <Td className="text-right">
                    {a.id !== meId && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => { setResetFor(a); setNewPassword(""); }}><KeyRound /> Password</Button>
                        <Button size="sm" variant={a.status === "active" ? "danger-outline" : "outline"} onClick={() => void update(a.id, { status: a.status === "active" ? "disabled" : "active" }, a.status === "active" ? "Account disabled" : "Account enabled")}>
                          {a.status === "active" ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      </div>
      <Card>
        <CardHeader><CardTitle>Roles</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {ROLES.map((r) => (
            <div key={r}><p className="font-semibold">{ROLE_LABELS[r]}</p><p className="text-muted-foreground">{ROLE_HELP[r]}</p></div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add staff member</DialogTitle><DialogDescription>Share the password with them securely; they should change it after first sign-in.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <Field id="s-name" label="Name" error={errors.name}><Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field id="s-email" label="Email" error={errors.email}><Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field id="s-role" label="Role" hint={ROLE_HELP[form.role]}>
              <NativeSelect id="s-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</NativeSelect>
            </Field>
            <Field id="s-pass" label="Temporary password" error={errors.password} hint="At least 12 characters with upper- and lower-case letters and a number">
              <Input id="s-pass" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={create} loading={busy}>Create account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetFor !== null} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set a new password</DialogTitle><DialogDescription>{resetFor?.name} will be signed out everywhere.</DialogDescription></DialogHeader>
          <Field id="r-pass" label="New password" hint="At least 12 characters with upper- and lower-case letters and a number">
            <Input id="r-pass" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button onClick={async () => { if (resetFor && (await update(resetFor.id, { password: newPassword }, "Password updated"))) setResetFor(null); }}>Save password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
