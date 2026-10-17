"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { Archive, Boxes, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { GST_RATES } from "@/lib/constants";
import { slugify, toRupees } from "@/lib/utils";
import type { AdminProductDTO, CategoryDTO, ImageDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label, Switch } from "@/components/ui/primitives";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display";
import { Field } from "@/components/checkout/address-fields";
import { ImageUploader } from "./image-uploader";

type VariantValues = { _id?: string; name: string; sku: string; optionsText: string; price: string; originalPrice: string; stock: string; status: "active" | "inactive" };
type Values = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  categoryId: string;
  brand: string;
  images: ImageDTO[];
  price: string;
  originalPrice: string;
  costPrice: string;
  gstRate: string;
  taxInclusive: boolean;
  hsnCode: string;
  stock: string;
  lowStockThreshold: string;
  barcode: string;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  featured: boolean;
  status: "active" | "draft" | "archived";
  seoTitle: string;
  seoDescription: string;
  tags: string;
  specifications: { label: string; value: string }[];
  variants: VariantValues[];
};

const r = (paise: number | null | undefined) => (paise === null || paise === undefined ? "" : String(toRupees(paise)));
const num = (s: string | undefined) => (s === undefined || String(s).trim() === "" ? undefined : Number(s));

/** "Colour: Blue; Size: A4" ⇄ [{name, value}] */
const parseOptions = (s: string) =>
  s
    .split(";")
    .map((p) => p.split(":").map((x) => x.trim()))
    .filter(([n, v]) => n && v)
    .map(([name, value]) => ({ name: name!, value: value! }));

export function ProductForm({
  product,
  categories,
  canSeeCost,
  canDelete,
  defaultGstRate,
  defaultTaxInclusive,
  defaultLowStock,
}: {
  product?: AdminProductDTO;
  categories: CategoryDTO[];
  canSeeCost: boolean;
  canDelete: boolean;
  defaultGstRate: number;
  defaultTaxInclusive: boolean;
  defaultLowStock: number;
}) {
  const router = useRouter();
  const editing = Boolean(product);
  const [saving, setSaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const slugTouched = React.useRef(Boolean(product));

  const form = useForm<Values>({
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      sku: product?.sku ?? "",
      description: product?.description ?? "",
      categoryId: product?.category?.id ?? categories[0]?.id ?? "",
      brand: product?.brand ?? "",
      images: product?.images ?? [],
      price: r(product?.price),
      originalPrice: r(product?.originalPrice),
      costPrice: r(product?.costPrice),
      gstRate: String(product?.tax.gstRate ?? defaultGstRate),
      taxInclusive: product?.tax.inclusive ?? defaultTaxInclusive,
      hsnCode: product?.tax.hsnCode ?? "",
      stock: String(product?.stock ?? 0),
      lowStockThreshold: String(product?.lowStockThreshold ?? defaultLowStock),
      barcode: product?.barcode ?? "",
      weightGrams: product?.weightGrams ? String(product.weightGrams) : "",
      lengthCm: product?.dimensions?.lengthCm ? String(product.dimensions.lengthCm) : "",
      widthCm: product?.dimensions?.widthCm ? String(product.dimensions.widthCm) : "",
      heightCm: product?.dimensions?.heightCm ? String(product.dimensions.heightCm) : "",
      featured: product?.featured ?? false,
      status: product?.status ?? "active",
      seoTitle: product?.seo.title ?? "",
      seoDescription: product?.seo.description ?? "",
      tags: product?.tags.join(", ") ?? "",
      specifications: product?.specifications ?? [],
      variants: (product?.variants ?? []).map((v) => ({
        _id: v.id,
        name: v.name,
        sku: v.sku,
        optionsText: v.options.map((o) => `${o.name}: ${o.value}`).join("; "),
        price: r(v.price),
        originalPrice: r(v.originalPrice),
        stock: String(v.stock),
        status: v.status,
      })),
    },
  });
  const { register, control, handleSubmit, setValue, watch, formState, setError } = form;
  const specs = useFieldArray({ control, name: "specifications" });
  const variants = useFieldArray({ control, name: "variants" });
  const errs = formState.errors;
  const err = (k: string) => (errs as Record<string, { message?: string }>)[k]?.message;

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    setSaving(true);
    const payload = {
      name: v.name,
      slug: v.slug,
      sku: v.sku,
      description: v.description,
      categoryId: v.categoryId,
      brand: v.brand,
      images: v.images,
      price: num(v.price) ?? 0,
      originalPrice: num(v.originalPrice),
      ...(canSeeCost ? { costPrice: num(v.costPrice) } : {}),
      tax: { gstRate: Number(v.gstRate), inclusive: v.taxInclusive, hsnCode: v.hsnCode },
      stock: num(v.stock) ?? 0,
      lowStockThreshold: num(v.lowStockThreshold) ?? 0,
      barcode: v.barcode || undefined,
      weightGrams: num(v.weightGrams),
      dimensions: { lengthCm: num(v.lengthCm), widthCm: num(v.widthCm), heightCm: num(v.heightCm) },
      featured: v.featured,
      status: v.status,
      seo: { title: v.seoTitle, description: v.seoDescription },
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      specifications: v.specifications.filter((s) => s.label && s.value),
      variants: v.variants.map((x) => ({
        _id: x._id,
        name: x.name,
        sku: x.sku,
        options: parseOptions(x.optionsText),
        price: num(x.price),
        originalPrice: num(x.originalPrice),
        stock: num(x.stock) ?? 0,
        status: x.status,
      })),
    };
    try {
      const res = editing
        ? await apiFetch<{ product: AdminProductDTO }>(`/api/admin/products/${product!.id}`, { method: "PATCH", body: payload })
        : await apiFetch<{ product: AdminProductDTO }>("/api/admin/products", { body: payload });
      toast.success(editing ? "Product updated — changes are live on the storefront" : "Product created");
      if (!editing) router.replace(`/admin/products/${res.product.id}`);
      router.refresh();
    } catch (e) {
      const ae = e as ApiError;
      setServerError(ae.message);
      const map: Record<string, keyof Values> = { "tax.gstRate": "gstRate", "seo.title": "seoTitle", "seo.description": "seoDescription" };
      for (const [k, m] of Object.entries(ae.fieldErrors ?? {})) {
        const key = (map[k] ?? k) as keyof Values;
        setError(key, { message: m });
      }
      if (ae.details?.field) setError(ae.details.field as keyof Values, { message: ae.message });
      toast.error(ae.message);
    } finally {
      setSaving(false);
    }
  });

  async function setStatus(status: "archived" | "active") {
    if (!product) return;
    try {
      await apiFetch(`/api/admin/products/${product.id}/status`, { body: { status } });
      toast.success(status === "archived" ? "Product archived — hidden from the storefront" : "Product restored");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function del() {
    if (!product || !confirm(`Permanently delete “${product.name}”? This can't be undone.`)) return;
    try {
      await apiFetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      toast.success("Product deleted");
      router.replace("/admin/products");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  }

  const hasVariants = watch("variants").length > 0;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 pb-20 md:pb-0 xl:grid-cols-[1fr_340px]">
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(22_27_51/0.25)] backdrop-blur-md md:hidden">
        <Button type="submit" className="w-full" size="lg" loading={saving}>
          <Save /> {editing ? "Save changes" : "Create product"}
        </Button>
      </div>
      <div className="space-y-5">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <Card>
          <CardHeader><CardTitle>Basic details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Product name" error={err("name")} className="sm:col-span-2">
              <Input
                id="name"
                aria-invalid={Boolean(err("name")) || undefined}
                {...register("name", {
                  required: "Product name is required",
                  onChange: (e) => !slugTouched.current && setValue("slug", slugify(e.target.value)),
                })}
              />
            </Field>
            <Field id="slug" label="URL slug" error={err("slug")} hint="Used in the product URL">
              <Input id="slug" {...register("slug", { onChange: () => (slugTouched.current = true) })} />
            </Field>
            <Field id="sku" label="SKU" error={err("sku")}>
              <Input id="sku" className="uppercase" {...register("sku", { required: "SKU is required" })} />
            </Field>
            <Field id="categoryId" label="Category" error={err("categoryId")}>
              <NativeSelect id="categoryId" {...register("categoryId", { required: "Choose a category" })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.status === "inactive" ? " (inactive)" : ""}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="brand" label="Brand (optional)" error={err("brand")}>
              <Input id="brand" {...register("brand")} />
            </Field>
            <Field id="description" label="Description" error={err("description")} className="sm:col-span-2">
              <Textarea id="description" rows={6} {...register("description")} />
            </Field>
            <Field id="tags" label="Search tags" hint="Comma separated, e.g. school, ruled, A4" className="sm:col-span-2">
              <Input id="tags" {...register("tags")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Images</CardTitle></CardHeader>
          <CardContent>
            <Controller control={control} name="images" render={({ field }) => <ImageUploader value={field.value} onChange={field.onChange} />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing &amp; tax</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field id="price" label="Selling price (₹)" error={err("price")}>
              <Input id="price" type="number" step="0.01" min="0" inputMode="decimal" {...register("price", { required: "Price is required" })} />
            </Field>
            <Field id="originalPrice" label="Original / MRP (₹)" error={err("originalPrice")} hint="Shows a strike-through discount">
              <Input id="originalPrice" type="number" step="0.01" min="0" inputMode="decimal" {...register("originalPrice")} />
            </Field>
            {canSeeCost && (
              <Field id="costPrice" label="Cost price (₹)" error={err("costPrice")} hint="Private — never shown to customers">
                <Input id="costPrice" type="number" step="0.01" min="0" inputMode="decimal" {...register("costPrice")} />
              </Field>
            )}
            <Field id="gstRate" label="GST rate" error={err("gstRate")}>
              <NativeSelect id="gstRate" {...register("gstRate")}>
                {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
              </NativeSelect>
            </Field>
            <Field id="hsnCode" label="HSN code (optional)">
              <Input id="hsnCode" {...register("hsnCode")} />
            </Field>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2.5 text-sm">
                <Switch checked={watch("taxInclusive")} onCheckedChange={(c) => setValue("taxInclusive", c)} /> Price includes GST
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Variants</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => variants.append({ name: "", sku: "", optionsText: "", price: "", originalPrice: "", stock: "0", status: "active" })}>
              <Plus /> Add variant
            </Button>
          </CardHeader>
          <CardContent>
            {variants.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No variants. Add variants for sizes, colours or pack options — each has its own SKU and stock.</p>
            ) : (
              <div className="space-y-3">
                {variants.fields.map((f, i) => {
                  const ve = (errs.variants?.[i] ?? {}) as Record<string, { message?: string }>;
                  const isExisting = Boolean(f._id);
                  return (
                    <div key={f.id} className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-surface-muted/40 p-3 sm:grid-cols-6">
                      <Field id={`v${i}name`} label="Name" error={ve.name?.message} className="sm:col-span-2">
                        <Input id={`v${i}name`} placeholder="Blue / A4" {...register(`variants.${i}.name`, { required: "Required" })} />
                      </Field>
                      <Field id={`v${i}sku`} label="SKU" error={ve.sku?.message} className="sm:col-span-2">
                        <Input id={`v${i}sku`} className="uppercase" {...register(`variants.${i}.sku`, { required: "Required" })} />
                      </Field>
                      <Field id={`v${i}opts`} label="Options" hint="Colour: Blue; Size: A4" className="sm:col-span-2">
                        <Input id={`v${i}opts`} {...register(`variants.${i}.optionsText`)} />
                      </Field>
                      <Field id={`v${i}price`} label="Price ₹ (optional)" className="sm:col-span-2">
                        <Input id={`v${i}price`} type="number" step="0.01" min="0" placeholder="Same as product" {...register(`variants.${i}.price`)} />
                      </Field>
                      <Field id={`v${i}stock`} label={isExisting ? "Stock (use Inventory to change)" : "Initial stock"} className="sm:col-span-2">
                        <Input id={`v${i}stock`} type="number" min="0" disabled={isExisting} {...register(`variants.${i}.stock`)} />
                      </Field>
                      <div className="flex items-end justify-between gap-2 sm:col-span-2">
                        <label className="flex items-center gap-2 pb-2.5 text-sm">
                          <Switch checked={watch(`variants.${i}.status`) === "active"} onCheckedChange={(c) => setValue(`variants.${i}.status`, c ? "active" : "inactive")} /> Active
                        </label>
                        <Button type="button" variant="ghost" size="icon" onClick={() => variants.remove(i)} aria-label="Remove variant" className="text-danger"><Trash2 /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Specifications</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => specs.append({ label: "", value: "" })}><Plus /> Add</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {specs.fields.length === 0 && <p className="text-sm text-muted-foreground">e.g. Pages: 200 · Ruling: Single line · Material: Steel</p>}
            {specs.fields.map((f, i) => (
              <div key={f.id} className="flex gap-2">
                <Input aria-label="Specification label" placeholder="Label" {...register(`specifications.${i}.label`)} />
                <Input aria-label="Specification value" placeholder="Value" {...register(`specifications.${i}.value`)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => specs.remove(i)} aria-label="Remove"><Trash2 /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Search engine listing</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field id="seoTitle" label="SEO title" error={err("seoTitle")} hint={`${watch("seoTitle").length}/70`}>
              <Input id="seoTitle" maxLength={70} {...register("seoTitle")} />
            </Field>
            <Field id="seoDescription" label="SEO description" error={err("seoDescription")} hint={`${watch("seoDescription").length}/170`}>
              <Textarea id="seoDescription" rows={2} maxLength={170} {...register("seoDescription")} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field id="status" label="Visibility">
              <NativeSelect id="status" {...register("status")}>
                <option value="active">Active — visible in store</option>
                <option value="draft">Draft — hidden</option>
                <option value="archived">Archived — hidden</option>
              </NativeSelect>
            </Field>
            <label className="flex items-center justify-between text-sm">
              <span><span className="font-medium">Featured</span><span className="block text-xs text-muted-foreground">Show on the homepage</span></span>
              <Switch checked={watch("featured")} onCheckedChange={(c) => setValue("featured", c)} />
            </label>
            <Button type="submit" className="w-full" loading={saving}><Save /> {editing ? "Save changes" : "Create product"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inventory</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {!hasVariants && (
              <Field id="stock" label={editing ? "Stock on hand" : "Initial stock"} error={err("stock")} hint={editing ? "Change stock from Inventory so it's logged" : undefined}>
                <Input id="stock" type="number" min="0" disabled={editing} {...register("stock")} />
              </Field>
            )}
            {hasVariants && <p className="text-sm text-muted-foreground">Stock is tracked per variant.</p>}
            <Field id="lowStockThreshold" label="Low-stock alert at" error={err("lowStockThreshold")}>
              <Input id="lowStockThreshold" type="number" min="0" {...register("lowStockThreshold")} />
            </Field>
            <Field id="barcode" label="Barcode (optional)">
              <Input id="barcode" {...register("barcode")} />
            </Field>
            {editing && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/inventory?productId=${product!.id}`}><Boxes /> Adjust stock / history</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Shipping</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field id="weightGrams" label="Weight (g)" className="col-span-2"><Input id="weightGrams" type="number" min="0" {...register("weightGrams")} /></Field>
            <Field id="lengthCm" label="Length (cm)"><Input id="lengthCm" type="number" min="0" {...register("lengthCm")} /></Field>
            <Field id="widthCm" label="Width (cm)"><Input id="widthCm" type="number" min="0" {...register("widthCm")} /></Field>
            <Field id="heightCm" label="Height (cm)"><Input id="heightCm" type="number" min="0" {...register("heightCm")} /></Field>
          </CardContent>
        </Card>

        {editing && (
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              {product!.status === "archived" ? (
                <Button type="button" variant="outline" className="w-full" onClick={() => setStatus("active")}>Restore product</Button>
              ) : (
                <Button type="button" variant="outline" className="w-full" onClick={() => setStatus("archived")}><Archive /> Archive</Button>
              )}
              {canDelete && <Button type="button" variant="danger-outline" className="w-full" onClick={del}><Trash2 /> Delete permanently</Button>}
              <Label className="block text-xs font-normal text-muted-foreground">Products that appear in orders can only be archived, not deleted.</Label>
            </CardContent>
          </Card>
        )}
      </div>
    </form>
  );
}
