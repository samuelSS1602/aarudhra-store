"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { Archive, Boxes, ChevronDown, Plus, Save, Trash2 } from "lucide-react";
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

/** Short readable SKU from the name, e.g. "Classmate Notebook" → "CLAS-NOTE-4K7Q". */
const autoSku = (name: string) => {
  const words = slugify(name).split("-").filter(Boolean).slice(0, 2).map((w) => w.slice(0, 4).toUpperCase());
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return [...(words.length ? words : ["ITEM"]), rand].join("-");
};

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
    const sku = v.sku.trim() || autoSku(v.name);
    if (!v.sku.trim()) setValue("sku", sku);
    const payload = {
      name: v.name,
      slug: v.slug,
      sku,
      description: v.description,
      categoryId: v.categoryId,
      brand: v.brand,
      images: v.images.map((img) => ({ ...img, alt: img.alt || v.name })),
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
      variants: v.variants.map((x, i) => ({
        _id: x._id,
        name: x.name,
        sku: x.sku.trim() || `${sku}-V${i + 1}`,
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
  const images = watch("images");

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-5 pb-24 md:pb-0">
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgb(22_27_51/0.25)] backdrop-blur-md md:hidden">
        <Button type="submit" className="w-full" size="lg" loading={saving}>
          <Save /> {editing ? "Save changes" : "Add product"}
        </Button>
      </div>
      {serverError && <Alert tone="danger">{serverError}</Alert>}

      {/* Step 1: photos */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <p className="text-sm text-muted-foreground">The first photo is shown in the shop. On a phone you can take photos with the camera.</p>
        </CardHeader>
        <CardContent>
          <Controller control={control} name="images" render={({ field }) => <ImageUploader value={field.value} onChange={field.onChange} withAlt={false} />} />
          {images.length === 0 && <p className="mt-3 text-xs text-muted-foreground">Tip: products with a photo sell much better.</p>}
        </CardContent>
      </Card>

      {/* Step 2: the essentials */}
      <Card>
        <CardHeader><CardTitle>Product details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Product name" error={err("name")} className="sm:col-span-2">
            <Input
              id="name"
              placeholder="e.g. Classmate Long Notebook 200 pages"
              aria-invalid={Boolean(err("name")) || undefined}
              {...register("name", {
                required: "Product name is required",
                onChange: (e) => !slugTouched.current && setValue("slug", slugify(e.target.value)),
              })}
            />
          </Field>
          <Field id="price" label="Selling price (₹)" error={err("price")}>
            <Input id="price" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0" {...register("price", { required: "Price is required" })} />
          </Field>
          <Field id="originalPrice" label="MRP (₹), optional" error={err("originalPrice")} hint="If higher than the price, a discount is shown">
            <Input id="originalPrice" type="number" step="0.01" min="0" inputMode="decimal" {...register("originalPrice")} />
          </Field>
          <Field id="categoryId" label="Category" error={err("categoryId")}>
            <NativeSelect id="categoryId" {...register("categoryId", { required: "Choose a category" })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.status === "inactive" ? " (inactive)" : ""}</option>
              ))}
            </NativeSelect>
          </Field>
          {!hasVariants ? (
            <Field id="stock" label={editing ? "Stock in hand" : "How many in stock?"} error={err("stock")} hint={editing ? "Change stock from Inventory so it's logged" : undefined}>
              <Input id="stock" type="number" min="0" inputMode="numeric" disabled={editing} {...register("stock")} />
            </Field>
          ) : (
            <p className="self-end pb-2.5 text-sm text-muted-foreground">Stock is tracked per variant (see More options).</p>
          )}
          <Field id="description" label="Description, optional" error={err("description")} className="sm:col-span-2">
            <Textarea id="description" rows={4} placeholder="Size, colour, material, pack quantity…" {...register("description")} />
          </Field>
          <div className="grid gap-3 rounded-[var(--radius-lg)] bg-surface-muted/60 p-3.5 sm:col-span-2 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span><span className="font-medium">Show in shop</span><span className="block text-xs text-muted-foreground">Off = saved as a hidden draft</span></span>
              <Switch checked={watch("status") === "active"} onCheckedChange={(c) => setValue("status", c ? "active" : "draft")} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span><span className="font-medium">Featured</span><span className="block text-xs text-muted-foreground">Show on the homepage</span></span>
              <Switch checked={watch("featured")} onCheckedChange={(c) => setValue("featured", c)} />
            </label>
          </div>
          <div className="hidden sm:col-span-2 md:block">
            <Button type="submit" size="lg" loading={saving}><Save /> {editing ? "Save changes" : "Add product"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Everything else, collapsed */}
      <details className="group rounded-[var(--radius-xl)] border border-border bg-surface shadow-soft" open={Boolean(errs.sku || errs.slug || errs.gstRate || errs.variants) || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-semibold">More options</span>
            <span className="block text-xs text-muted-foreground">SKU, brand, GST, variants, specifications, SEO, shipping. All optional.</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-7 border-t border-border p-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field id="sku" label="SKU" error={err("sku")} hint="Leave empty to create one automatically">
              <Input id="sku" className="uppercase" {...register("sku")} />
            </Field>
            <Field id="brand" label="Brand" error={err("brand")}>
              <Input id="brand" {...register("brand")} />
            </Field>
            <Field id="slug" label="URL slug" error={err("slug")} hint="Filled in from the name">
              <Input id="slug" {...register("slug", { onChange: () => (slugTouched.current = true) })} />
            </Field>
            <Field id="tags" label="Search tags" hint="Comma separated, e.g. school, ruled, A4">
              <Input id="tags" {...register("tags")} />
            </Field>
            <Field id="statusSelect" label="Visibility">
              <NativeSelect id="statusSelect" {...register("status")}>
                <option value="active">Active (visible in store)</option>
                <option value="draft">Draft (hidden)</option>
                <option value="archived">Archived (hidden)</option>
              </NativeSelect>
            </Field>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Tax &amp; cost</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="gstRate" label="GST rate" error={err("gstRate")}>
                <NativeSelect id="gstRate" {...register("gstRate")}>
                  {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                </NativeSelect>
              </Field>
              <Field id="hsnCode" label="HSN code">
                <Input id="hsnCode" {...register("hsnCode")} />
              </Field>
              {canSeeCost && (
                <Field id="costPrice" label="Cost price (₹)" error={err("costPrice")} hint="Private, never shown to customers">
                  <Input id="costPrice" type="number" step="0.01" min="0" inputMode="decimal" {...register("costPrice")} />
                </Field>
              )}
              <label className="flex items-center gap-2.5 text-sm sm:col-span-3">
                <Switch checked={watch("taxInclusive")} onCheckedChange={(c) => setValue("taxInclusive", c)} /> Price includes GST
              </label>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Variants</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => variants.append({ name: "", sku: "", optionsText: "", price: "", originalPrice: "", stock: "0", status: "active" })}>
                <Plus /> Add variant
              </Button>
            </div>
            {variants.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">For sizes, colours or pack options. Each has its own stock.</p>
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
                        <Input id={`v${i}sku`} className="uppercase" placeholder="Auto" {...register(`variants.${i}.sku`)} />
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
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Specifications</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => specs.append({ label: "", value: "" })}><Plus /> Add</Button>
            </div>
            {specs.fields.length === 0 && <p className="text-sm text-muted-foreground">e.g. Pages: 200 · Ruling: Single line · Material: Steel</p>}
            <div className="space-y-2">
              {specs.fields.map((f, i) => (
                <div key={f.id} className="flex gap-2">
                  <Input aria-label="Specification label" placeholder="Label" {...register(`specifications.${i}.label`)} />
                  <Input aria-label="Specification value" placeholder="Value" {...register(`specifications.${i}.value`)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => specs.remove(i)} aria-label="Remove"><Trash2 /></Button>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">Stock alert, barcode &amp; shipping</h3>
            <Field id="lowStockThreshold" label="Low-stock alert at" error={err("lowStockThreshold")}>
              <Input id="lowStockThreshold" type="number" min="0" {...register("lowStockThreshold")} />
            </Field>
            <Field id="barcode" label="Barcode">
              <Input id="barcode" {...register("barcode")} />
            </Field>
            <Field id="weightGrams" label="Weight (g)"><Input id="weightGrams" type="number" min="0" {...register("weightGrams")} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field id="lengthCm" label="L (cm)"><Input id="lengthCm" type="number" min="0" {...register("lengthCm")} /></Field>
              <Field id="widthCm" label="W (cm)"><Input id="widthCm" type="number" min="0" {...register("widthCm")} /></Field>
              <Field id="heightCm" label="H (cm)"><Input id="heightCm" type="number" min="0" {...register("heightCm")} /></Field>
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-sm font-semibold">Search engine listing</h3>
            <Field id="seoTitle" label="SEO title" error={err("seoTitle")} hint={`${watch("seoTitle").length}/70`}>
              <Input id="seoTitle" maxLength={70} {...register("seoTitle")} />
            </Field>
            <Field id="seoDescription" label="SEO description" error={err("seoDescription")} hint={`${watch("seoDescription").length}/170`}>
              <Textarea id="seoDescription" rows={2} maxLength={170} {...register("seoDescription")} />
            </Field>
          </section>
        </div>
      </details>

      {editing && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-5 sm:pt-6">
            {product!.status === "archived" ? (
              <Button type="button" variant="outline" onClick={() => setStatus("active")}>Restore product</Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setStatus("archived")}><Archive /> Archive</Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/admin/inventory?productId=${product!.id}`}><Boxes /> Adjust stock / history</Link>
            </Button>
            {canDelete && <Button type="button" variant="danger-outline" onClick={del}><Trash2 /> Delete permanently</Button>}
            <Label className="block w-full text-xs font-normal text-muted-foreground">Products that appear in orders can only be archived, not deleted.</Label>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
