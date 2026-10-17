"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { GST_RATES, ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/constants";
import type { StoreSettings } from "@/lib/settings-defaults";
import { toPaise, toRupees } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { Field } from "@/components/checkout/address-fields";
import { ICON_NAMES } from "@/components/storefront/icons";
import { ImageUploader } from "./image-uploader";

type Section = keyof StoreSettings;

function useSection<S extends Section>(initial: StoreSettings[S]) {
  const [value, setValue] = React.useState(initial);
  const set = React.useCallback(<K extends keyof StoreSettings[S]>(k: K, v: StoreSettings[S][K]) => setValue((prev) => ({ ...prev, [k]: v })), []);
  return [value, set, setValue] as const;
}

function SaveBar({ onSave, saving, locked }: { onSave: () => void; saving: boolean; locked?: boolean }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[var(--radius-lg)] sm:border">
      {locked ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" /> Only administrators can change these settings.</p>
      ) : (
        <Button onClick={onSave} loading={saving}><Save /> Save changes</Button>
      )}
    </div>
  );
}

export function SettingsEditor({
  initial,
  initialTab,
  categories,
  canSecurity,
  envDefaults,
}: {
  initial: StoreSettings;
  initialTab: string;
  categories: { id: string; name: string }[];
  canSecurity: boolean;
  envDefaults: { ownerNumber: string; ownerTemplate: string; language: string };
}) {
  const router = useRouter();
  const [general, setG, setGeneral] = useSection<"general">(initial.general);
  const [commerce, setC] = useSection<"commerce">(initial.commerce);
  const [notifications, setN] = useSection<"notifications">(initial.notifications);
  const [homepage, setH] = useSection<"homepage">(initial.homepage);
  const [saving, setSaving] = React.useState<Section | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  async function save(section: Section, data: unknown) {
    setSaving(section);
    setErrors({});
    try {
      await apiFetch("/api/admin/settings", { method: "PATCH", body: { section, data } });
      toast.success("Settings saved");
      router.refresh();
    } catch (e) {
      const ae = e as ApiError;
      setErrors(Object.fromEntries(Object.entries(ae.fieldErrors ?? {}).map(([k, v]) => [k.replace(/^data\./, ""), v])));
      toast.error(ae.message);
    } finally {
      setSaving(null);
    }
  }
  const err = (k: string) => errors[k];
  const rupees = (p: number) => String(toRupees(p));
  const paise = (s: string) => toPaise(Number(s) || 0);

  return (
    <Tabs defaultValue={initialTab}>
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="commerce">Commerce</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="homepage">Homepage</TabsTrigger>
      </TabsList>

      {/* ------------------------------ General ------------------------------ */}
      <TabsContent value="general">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Store identity</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Field id="g-name" label="Store name" error={err("storeName")}><Input id="g-name" value={general.storeName} onChange={(e) => setG("storeName", e.target.value)} /></Field>
              <Field id="g-tag" label="Tagline"><Input id="g-tag" value={general.tagline} onChange={(e) => setG("tagline", e.target.value)} /></Field>
              <Field id="g-desc" label="Store description" error={err("description")}><Textarea id="g-desc" rows={4} value={general.description} onChange={(e) => setG("description", e.target.value)} /></Field>
              <div>
                <p className="mb-1.5 text-sm font-medium">Logo (used in structured data and invoices)</p>
                <ImageUploader max={1} folder="branding" value={general.logoUrl ? [{ url: general.logoUrl }] : []} onChange={(imgs) => setG("logoUrl", imgs[0]?.url ?? "")} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle><CardDescription>Leave blank to hide. Only real, working contact details should be entered.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="g-phone" label="Support phone" error={err("supportPhone")}><Input id="g-phone" type="tel" value={general.supportPhone} onChange={(e) => setG("supportPhone", e.target.value)} /></Field>
              <Field id="g-wa" label="WhatsApp Business number" error={err("whatsappNumber")} hint="Customers' “Chat on WhatsApp” button"><Input id="g-wa" type="tel" value={general.whatsappNumber} onChange={(e) => setG("whatsappNumber", e.target.value)} /></Field>
              <Field id="g-email" label="Contact email" error={err("contactEmail")}><Input id="g-email" type="email" value={general.contactEmail} onChange={(e) => setG("contactEmail", e.target.value)} /></Field>
              <Field id="g-hours" label="Store hours"><Input id="g-hours" placeholder="e.g. Mon–Sat 9:30 AM – 9:00 PM" value={general.storeHours} onChange={(e) => setG("storeHours", e.target.value)} /></Field>
              {(["facebook", "instagram", "youtube"] as const).map((s) => (
                <Field key={s} id={`g-${s}`} label={`${s[0]!.toUpperCase()}${s.slice(1)} URL`} error={err(`social.${s}`)}>
                  <Input id={`g-${s}`} type="url" value={general.social[s]} onChange={(e) => setG("social", { ...general.social, [s]: e.target.value })} />
                </Field>
              ))}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Business address</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {(["line1", "line2", "city", "district", "state", "pincode", "country"] as const).map((k) => (
                <Field key={k} id={`a-${k}`} label={{ line1: "Address line 1", line2: "Address line 2", city: "Town / city", district: "District", state: "State", pincode: "PIN code", country: "Country" }[k]} error={err(`address.${k}`)} className={k === "line1" || k === "line2" ? "sm:col-span-3" : ""}>
                  <Input id={`a-${k}`} value={general.address[k]} onChange={(e) => setGeneral({ ...general, address: { ...general.address, [k]: e.target.value } })} />
                </Field>
              ))}
              <Field id="g-map" label="Map search text" hint="Used for the embedded map and directions link" className="sm:col-span-3"><Input id="g-map" value={general.mapQuery} onChange={(e) => setG("mapQuery", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </div>
        <SaveBar saving={saving === "general"} onSave={() => save("general", general)} />
      </TabsContent>

      {/* ------------------------------ Commerce ----------------------------- */}
      <TabsContent value="commerce">
        {!canSecurity && <Alert tone="info" className="mb-4">Commerce settings affect pricing and payments, so only administrators can change them.</Alert>}
        <fieldset disabled={!canSecurity} className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Tax &amp; orders</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="c-taxmode" label="Default tax mode for new products">
                <NativeSelect id="c-taxmode" value={commerce.taxMode} onChange={(e) => setC("taxMode", e.target.value as "inclusive" | "exclusive")}>
                  <option value="inclusive">Prices include GST</option>
                  <option value="exclusive">GST added at checkout</option>
                </NativeSelect>
              </Field>
              <Field id="c-gst" label="Default GST rate">
                <NativeSelect id="c-gst" value={commerce.defaultGstRate} onChange={(e) => setC("defaultGstRate", Number(e.target.value))}>
                  {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                </NativeSelect>
              </Field>
              <Field id="c-free" label="Free delivery above (₹, 0 = off)" error={err("freeDeliveryThreshold")}><Input id="c-free" type="number" min="0" value={rupees(commerce.freeDeliveryThreshold)} onChange={(e) => setC("freeDeliveryThreshold", paise(e.target.value))} /></Field>
              <Field id="c-min" label="Minimum order value (₹)" error={err("minimumOrderValue")}><Input id="c-min" type="number" min="0" value={rupees(commerce.minimumOrderValue)} onChange={(e) => setC("minimumOrderValue", paise(e.target.value))} /></Field>
              <Field id="c-low" label="Default low-stock threshold"><Input id="c-low" type="number" min="0" value={commerce.lowStockThreshold} onChange={(e) => setC("lowStockThreshold", Number(e.target.value) || 0)} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payments</CardTitle><CardDescription>Online payment is not integrated yet and stays disabled.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              <label className="flex items-center justify-between text-sm"><span className="font-medium">Cash on Delivery</span><Switch checked={commerce.codEnabled} onCheckedChange={(v) => setC("codEnabled", v)} /></label>
              <Field id="c-codmax" label="COD limit per order (₹, 0 = no limit)"><Input id="c-codmax" type="number" min="0" value={rupees(commerce.codMaxOrderValue)} onChange={(e) => setC("codMaxOrderValue", paise(e.target.value))} /></Field>
              <div>
                <p className="mb-2 text-sm font-medium">Customers can cancel online while an order is:</p>
                {(["pending", "confirmed", "processing"] as const).map((s) => (
                  <label key={s} className="mb-1.5 flex items-center gap-2 text-sm">
                    <Checkbox checked={commerce.customerCancellableStatuses.includes(s)} onCheckedChange={(v) => setC("customerCancellableStatuses", v ? [...commerce.customerCancellableStatuses, s] : commerce.customerCancellableStatuses.filter((x) => x !== s))} />
                    {ORDER_STATUS_LABELS[s]}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Delivery options</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setC("deliveryOptions", [...commerce.deliveryOptions, { id: `option-${commerce.deliveryOptions.length + 1}`, label: "", description: "", charge: 0, etaText: "", enabled: true }])}><Plus /> Add</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {err("deliveryOptions") && <p className="text-sm text-danger">{err("deliveryOptions")}</p>}
              {commerce.deliveryOptions.map((o, i) => {
                const upd = (patch: Partial<typeof o>) => setC("deliveryOptions", commerce.deliveryOptions.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="grid gap-3 rounded-[var(--radius-lg)] border border-border p-3 sm:grid-cols-12">
                    <Field id={`d-id-${i}`} label="ID" error={err(`deliveryOptions.${i}.id`)} className="sm:col-span-2"><Input id={`d-id-${i}`} value={o.id} onChange={(e) => upd({ id: e.target.value })} /></Field>
                    <Field id={`d-label-${i}`} label="Label" error={err(`deliveryOptions.${i}.label`)} className="sm:col-span-3"><Input id={`d-label-${i}`} value={o.label} onChange={(e) => upd({ label: e.target.value })} /></Field>
                    <Field id={`d-desc-${i}`} label="Description" className="sm:col-span-3"><Input id={`d-desc-${i}`} value={o.description} onChange={(e) => upd({ description: e.target.value })} /></Field>
                    <Field id={`d-charge-${i}`} label="Charge ₹" className="sm:col-span-1"><Input id={`d-charge-${i}`} type="number" min="0" value={rupees(o.charge)} onChange={(e) => upd({ charge: paise(e.target.value) })} /></Field>
                    <Field id={`d-eta-${i}`} label="Estimate" className="sm:col-span-2"><Input id={`d-eta-${i}`} value={o.etaText} onChange={(e) => upd({ etaText: e.target.value })} /></Field>
                    <div className="flex items-end justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-center">
                      <Switch aria-label="Enabled" checked={o.enabled} onCheckedChange={(v) => upd({ enabled: v })} />
                      <Button type="button" variant="ghost" size="icon-sm" className="text-danger" aria-label="Remove option" onClick={() => setC("deliveryOptions", commerce.deliveryOptions.filter((_, k) => k !== i))}><Trash2 /></Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Policies</CardTitle></CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <Field id="p-ret" label="Return policy"><Textarea id="p-ret" rows={6} value={commerce.returnPolicy} onChange={(e) => setC("returnPolicy", e.target.value)} /></Field>
              <Field id="p-can" label="Cancellation policy"><Textarea id="p-can" rows={6} value={commerce.cancellationPolicy} onChange={(e) => setC("cancellationPolicy", e.target.value)} /></Field>
              <Field id="p-del" label="Delivery policy"><Textarea id="p-del" rows={6} value={commerce.deliveryPolicy} onChange={(e) => setC("deliveryPolicy", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </fieldset>
        <SaveBar locked={!canSecurity} saving={saving === "commerce"} onSave={() => save("commerce", commerce)} />
      </TabsContent>

      {/* --------------------------- Notifications --------------------------- */}
      <TabsContent value="notifications">
        {!canSecurity && <Alert tone="info" className="mb-4">Notification recipients and templates are security-sensitive; only administrators can change them.</Alert>}
        <fieldset disabled={!canSecurity} className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Store-owner alerts</CardTitle><CardDescription>Who receives a WhatsApp message for every new order.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              <label className="flex items-center justify-between text-sm"><span className="font-medium">Send new-order alerts</span><Switch checked={notifications.ownerNewOrder} onCheckedChange={(v) => setN("ownerNewOrder", v)} /></label>
              <div>
                <p className="mb-1.5 text-sm font-medium">Recipient numbers</p>
                {notifications.ownerWhatsappNumbers.map((n, i) => (
                  <div key={i} className="mb-2 flex gap-2">
                    <Input aria-label={`Recipient ${i + 1}`} type="tel" value={n} onChange={(e) => setN("ownerWhatsappNumbers", notifications.ownerWhatsappNumbers.map((x, k) => (k === i ? e.target.value : x)))} aria-invalid={Boolean(err(`ownerWhatsappNumbers.${i}`)) || undefined} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setN("ownerWhatsappNumbers", notifications.ownerWhatsappNumbers.filter((_, k) => k !== i))}><X /></Button>
                  </div>
                ))}
                {notifications.ownerWhatsappNumbers.length < 5 && <Button type="button" variant="outline" size="sm" onClick={() => setN("ownerWhatsappNumbers", [...notifications.ownerWhatsappNumbers, ""])}><Plus /> Add number</Button>}
                <p className="mt-2 text-xs text-muted-foreground">{envDefaults.ownerNumber ? `If empty, WHATSAPP_OWNER_NUMBER (${envDefaults.ownerNumber}) is used.` : "No fallback WHATSAPP_OWNER_NUMBER is set in the environment."}</p>
              </div>
              <Field id="n-mode" label="Owner message type" hint="Template messages work any time. Text messages only deliver if the owner has messaged the business number in the last 24 hours.">
                <NativeSelect id="n-mode" value={notifications.ownerMessageMode} onChange={(e) => setN("ownerMessageMode", e.target.value as "template" | "text")}>
                  <option value="template">Approved template (recommended)</option>
                  <option value="text">Free-form text</option>
                </NativeSelect>
              </Field>
              <Field id="n-owner-tpl" label="Owner template name" error={err("ownerTemplateName")} hint={envDefaults.ownerTemplate ? `Default from env: ${envDefaults.ownerTemplate}` : "e.g. new_order_alert"}>
                <Input id="n-owner-tpl" value={notifications.ownerTemplateName} onChange={(e) => setN("ownerTemplateName", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Customer updates</CardTitle><CardDescription>Sent only to customers who opted in at checkout. Transactional only — never marketing.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              <label className="flex items-center justify-between text-sm"><span className="font-medium">Order confirmation</span><Switch checked={notifications.customerOrderConfirmation} onCheckedChange={(v) => setN("customerOrderConfirmation", v)} /></label>
              <Field id="n-cust-tpl" label="Confirmation template name" error={err("customerTemplateName")}><Input id="n-cust-tpl" value={notifications.customerTemplateName} onChange={(e) => setN("customerTemplateName", e.target.value)} /></Field>
              <label className="flex items-center justify-between text-sm"><span className="font-medium">Status updates</span><Switch checked={notifications.customerStatusUpdates} onCheckedChange={(v) => setN("customerStatusUpdates", v)} /></label>
              <Field id="n-status-tpl" label="Status-update template name" error={err("statusTemplateName")}><Input id="n-status-tpl" value={notifications.statusTemplateName} onChange={(e) => setN("statusTemplateName", e.target.value)} /></Field>
              <div>
                <p className="mb-2 text-sm font-medium">Send updates when an order becomes:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ORDER_STATUSES.filter((s) => s !== "pending").map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={notifications.statusUpdateEvents.includes(s)} onCheckedChange={(v) => setN("statusUpdateEvents", v ? [...notifications.statusUpdateEvents, s] : notifications.statusUpdateEvents.filter((x) => x !== s))} />
                      {ORDER_STATUS_LABELS[s]}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Delivery &amp; retries</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field id="n-lang" label="Template language code" error={err("templateLanguage")} hint={`Blank = ${envDefaults.language}`}><Input id="n-lang" value={notifications.templateLanguage} onChange={(e) => setN("templateLanguage", e.target.value)} /></Field>
              <Field id="n-max" label="Max automatic attempts"><Input id="n-max" type="number" min="1" max="10" value={notifications.maxAttempts} onChange={(e) => setN("maxAttempts", Number(e.target.value) || 1)} /></Field>
              <Field id="n-base" label="First retry after (minutes)" hint="Doubles after each failure"><Input id="n-base" type="number" min="1" max="120" value={notifications.retryBaseMinutes} onChange={(e) => setN("retryBaseMinutes", Number(e.target.value) || 1)} /></Field>
            </CardContent>
          </Card>
        </fieldset>
        <SaveBar locked={!canSecurity} saving={saving === "notifications"} onSave={() => save("notifications", notifications)} />
      </TabsContent>

      {/* ------------------------------ Homepage ----------------------------- */}
      <TabsContent value="homepage">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Announcement bar</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <label className="flex items-center justify-between text-sm"><span className="font-medium">Show announcement</span><Switch checked={homepage.announcement.enabled} onCheckedChange={(v) => setH("announcement", { ...homepage.announcement, enabled: v })} /></label>
              <Field id="h-ann" label="Text"><Input id="h-ann" maxLength={160} value={homepage.announcement.text} onChange={(e) => setH("announcement", { ...homepage.announcement, text: e.target.value })} /></Field>
              <Field id="h-ann-href" label="Link (optional)" error={err("announcement.href")}><Input id="h-ann-href" value={homepage.announcement.href} onChange={(e) => setH("announcement", { ...homepage.announcement, href: e.target.value })} /></Field>
              <label className="flex items-center justify-between text-sm"><span className="font-medium">Newsletter sign-up section</span><Switch checked={homepage.newsletterEnabled} onCheckedChange={(v) => setH("newsletterEnabled", v)} /></label>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Hero banner</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="h-eyebrow" label="Eyebrow" className="sm:col-span-2"><Input id="h-eyebrow" value={homepage.hero.eyebrow} onChange={(e) => setH("hero", { ...homepage.hero, eyebrow: e.target.value })} /></Field>
              <Field id="h-title" label="Headline" error={err("hero.title")} className="sm:col-span-2"><Input id="h-title" value={homepage.hero.title} onChange={(e) => setH("hero", { ...homepage.hero, title: e.target.value })} /></Field>
              <Field id="h-sub" label="Subtitle" className="sm:col-span-2"><Textarea id="h-sub" rows={2} value={homepage.hero.subtitle} onChange={(e) => setH("hero", { ...homepage.hero, subtitle: e.target.value })} /></Field>
              <Field id="h-cta" label="Button label"><Input id="h-cta" value={homepage.hero.ctaLabel} onChange={(e) => setH("hero", { ...homepage.hero, ctaLabel: e.target.value })} /></Field>
              <Field id="h-cta-href" label="Button link" error={err("hero.ctaHref")}><Input id="h-cta-href" value={homepage.hero.ctaHref} onChange={(e) => setH("hero", { ...homepage.hero, ctaHref: e.target.value })} /></Field>
              <Field id="h-cta2" label="Second button label"><Input id="h-cta2" value={homepage.hero.secondaryCtaLabel} onChange={(e) => setH("hero", { ...homepage.hero, secondaryCtaLabel: e.target.value })} /></Field>
              <Field id="h-cta2-href" label="Second button link" error={err("hero.secondaryCtaHref")}><Input id="h-cta2-href" value={homepage.hero.secondaryCtaHref} onChange={(e) => setH("hero", { ...homepage.hero, secondaryCtaHref: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-sm font-medium">Hero image (optional — otherwise category tiles are shown)</p>
                <ImageUploader max={1} folder="banners" value={homepage.hero.imageUrl ? [{ url: homepage.hero.imageUrl }] : []} onChange={(imgs) => setH("hero", { ...homepage.hero, imageUrl: imgs[0]?.url ?? "" })} />
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Promotional banners</CardTitle>
              {homepage.banners.length < 6 && <Button type="button" size="sm" variant="outline" onClick={() => setH("banners", [...homepage.banners, { title: "", subtitle: "", href: "/products", imageUrl: "", tone: "green" }])}><Plus /> Add banner</Button>}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {homepage.banners.map((b, i) => {
                const upd = (patch: Partial<typeof b>) => setH("banners", homepage.banners.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="grid gap-3 rounded-[var(--radius-lg)] border border-border p-3">
                    <div className="flex gap-2">
                      <Input aria-label="Banner title" placeholder="Title" value={b.title} onChange={(e) => upd({ title: e.target.value })} />
                      <Button type="button" variant="ghost" size="icon" className="text-danger" aria-label="Remove banner" onClick={() => setH("banners", homepage.banners.filter((_, k) => k !== i))}><Trash2 /></Button>
                    </div>
                    <Input aria-label="Banner subtitle" placeholder="Subtitle" value={b.subtitle} onChange={(e) => upd({ subtitle: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input aria-label="Banner link" placeholder="/categories/…" value={b.href} onChange={(e) => upd({ href: e.target.value })} />
                      <NativeSelect aria-label="Banner colour" value={b.tone} onChange={(e) => upd({ tone: e.target.value as typeof b.tone })}>
                        <option value="green">Green</option><option value="gold">Gold</option><option value="charcoal">Charcoal</option><option value="lime">Lime</option>
                      </NativeSelect>
                    </div>
                    <ImageUploader max={1} folder="banners" value={b.imageUrl ? [{ url: b.imageUrl }] : []} onChange={(imgs) => upd({ imageUrl: imgs[0]?.url ?? "" })} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Featured categories</CardTitle><CardDescription>None selected = all active categories in display order.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-1.5">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={homepage.featuredCategoryIds.includes(c.id)} onCheckedChange={(v) => setH("featuredCategoryIds", v ? [...homepage.featuredCategoryIds, c.id] : homepage.featuredCategoryIds.filter((x) => x !== c.id))} />
                  {c.name}
                </label>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Store highlights</CardTitle><CardDescription>“Why shop with us” section.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {homepage.highlights.map((h, i) => {
                const upd = (patch: Partial<typeof h>) => setH("highlights", homepage.highlights.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                    <NativeSelect aria-label="Icon" value={h.icon} onChange={(e) => upd({ icon: e.target.value })}>{ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect>
                    <div className="grid gap-2">
                      <Input aria-label="Highlight title" value={h.title} onChange={(e) => upd({ title: e.target.value })} />
                      <Input aria-label="Highlight text" value={h.text} onChange={(e) => upd({ text: e.target.value })} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="text-danger" aria-label="Remove" onClick={() => setH("highlights", homepage.highlights.filter((_, k) => k !== i))}><Trash2 /></Button>
                  </div>
                );
              })}
              {homepage.highlights.length < 8 && <Button type="button" size="sm" variant="outline" onClick={() => setH("highlights", [...homepage.highlights, { icon: "Sparkles", title: "", text: "" }])}><Plus /> Add highlight</Button>}
              <p className="text-xs text-muted-foreground">Featured products are chosen with the “Featured” switch on each product.</p>
            </CardContent>
          </Card>
        </div>
        <SaveBar saving={saving === "homepage"} onSave={() => save("homepage", homepage)} />
      </TabsContent>
    </Tabs>
  );
}
