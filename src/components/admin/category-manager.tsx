"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Reorder } from "framer-motion";
import { ArrowDown, ArrowUp, FolderTree, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { slugify } from "@/lib/utils";
import type { CategoryDTO, ImageDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/primitives";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/checkout/address-fields";
import { DynamicIcon, ICON_NAMES } from "@/components/storefront/icons";
import { ImageUploader } from "./image-uploader";

type Draft = { id?: string; name: string; slug: string; description: string; icon: string; status: "active" | "inactive"; image: ImageDTO | null };

export function CategoryManager({ initial, canWrite }: { initial: CategoryDTO[]; canWrite: boolean }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CategoryDTO | null>(null);
  const [reassignTo, setReassignTo] = React.useState("");
  const orderDirty = React.useRef(false);

  React.useEffect(() => setItems(initial), [initial]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErrors({});
    const body = { name: draft.name, slug: draft.slug, description: draft.description, icon: draft.icon, status: draft.status, image: draft.image, displayOrder: draft.id ? items.find((i) => i.id === draft.id)?.displayOrder ?? 0 : 0 };
    try {
      if (draft.id) await apiFetch(`/api/admin/categories/${draft.id}`, { method: "PATCH", body });
      else await apiFetch("/api/admin/categories", { body });
      toast.success("Category saved");
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

  async function persistOrder(next: CategoryDTO[]) {
    try {
      await apiFetch("/api/admin/categories/reorder", { body: { ids: next.map((c) => c.id) } });
      toast.success("Order saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reorder");
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setItems(next);
    void persistOrder(next);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/admin/categories/${deleting.id}`, { method: "DELETE", body: reassignTo ? { reassignTo } : {} });
      toast.success("Category deleted");
      setDeleting(null);
      setReassignTo("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  }

  return (
    <div>
      {canWrite && (
        <Button className="mb-4" onClick={() => setDraft({ name: "", slug: "", description: "", icon: "Package", status: "active", image: null })}>
          <Plus /> Add category
        </Button>
      )}
      {items.length === 0 ? (
        <Card><EmptyState icon={FolderTree} title="No categories yet" description="Add categories like School Stationery or Kitchen Accessories." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next) => {
              orderDirty.current = true;
              setItems(next);
            }}
            className="divide-y divide-border"
          >
            {items.map((c, i) => (
              <Reorder.Item
                key={c.id}
                value={c}
                dragListener={canWrite}
                onDragEnd={() => {
                  if (orderDirty.current) {
                    orderDirty.current = false;
                    void persistOrder(items);
                  }
                }}
                className="flex items-center gap-3 bg-surface px-4 py-3"
              >
                {canWrite && <GripVertical className="size-4 shrink-0 cursor-grab text-subtle-foreground" aria-hidden />}
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
                  <DynamicIcon name={c.icon} className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {c.name}
                    {c.status === "inactive" && <Badge tone="warning">Disabled</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">/{c.slug} · {c.productCount ?? 0} products</p>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${c.name} up`}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${c.name} down`}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDraft({ id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon || "Package", status: c.status, image: c.image })} aria-label={`Edit ${c.name}`}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" className="text-danger" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}><Trash2 /></Button>
                  </div>
                )}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </Card>
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <Field id="cat-name" label="Name" error={errors.name}>
                <Input id="cat-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.id ? draft.slug : slugify(e.target.value) })} />
              </Field>
              <Field id="cat-slug" label="Slug" error={errors.slug} hint={`/categories/${draft.slug || "…"}`}>
                <Input id="cat-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              </Field>
              <Field id="cat-desc" label="Description" error={errors.description}>
                <Textarea id="cat-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <Field id="cat-icon" label="Icon">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary"><DynamicIcon name={draft.icon} className="size-5" /></div>
                  <NativeSelect id="cat-icon" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })}>
                    {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </NativeSelect>
                </div>
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-medium">Image (optional)</p>
                <ImageUploader value={draft.image ? [draft.image] : []} onChange={(imgs) => setDraft({ ...draft, image: imgs[0] ?? null })} max={1} folder="categories" />
              </div>
              <label className="flex items-center gap-2.5 text-sm">
                <Switch checked={draft.status === "active"} onCheckedChange={(c) => setDraft({ ...draft, status: c ? "active" : "inactive" })} />
                Visible in the storefront
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              {deleting?.productCount ? `${deleting.productCount} product(s) use this category. Choose where to move them first.` : "This category has no products."}
            </DialogDescription>
          </DialogHeader>
          {Boolean(deleting?.productCount) && (
            <Field id="reassign" label="Move products to">
              <NativeSelect id="reassign" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Choose a category…</option>
                {items.filter((c) => c.id !== deleting?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={Boolean(deleting?.productCount) && !reassignTo}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
