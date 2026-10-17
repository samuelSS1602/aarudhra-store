"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Banknote, CheckCircle2, CreditCard, Lock, MapPin, MessageCircle, Pencil, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/client-api";
import { formatPhoneForDisplay, normalizePhone } from "@/lib/phone";
import { cn, formatINR } from "@/lib/utils";
import type { AddressDTO, QuoteDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/primitives";
import { Alert, Card, EmptyState, Skeleton } from "@/components/ui/display";
import { useCart } from "@/components/providers/cart-provider";
import { useQuote } from "@/components/cart/use-quote";
import { OrderSummary } from "@/components/cart/order-summary";
import { CouponInput } from "@/components/cart/coupon-input";
import { ProductImage } from "@/components/products/product-image";
import { AddressFields, Field } from "./address-fields";

const formSchema = z.object({
  customerName: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address")]),
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  phone: z.string().trim().refine((v) => Boolean(normalizePhone(v)), "Enter a valid 10-digit mobile number"),
  line1: z.string().trim().min(3, "Please enter your house / street").max(200),
  line2: z.string().trim().max(200),
  landmark: z.string().trim().max(120),
  city: z.string().trim().min(2, "Town / city is required").max(80),
  district: z.string().trim().min(2, "District is required").max(80),
  state: z.string().trim().min(2, "State is required"),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
  instructions: z.string().trim().max(300),
  saveAddress: z.boolean(),
  whatsappOptIn: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

type Profile = {
  name: string;
  phoneNumber: string | null;
  contactPhone: string | null;
  email: string;
  addresses: AddressDTO[];
  preferences: { whatsappOrderUpdates: boolean };
};

const emptyAddress = (profile: Profile) => ({
  fullName: profile.name,
  phone: (profile.phoneNumber ?? profile.contactPhone ?? "").replace(/^\+91/, ""),
  line1: "",
  line2: "",
  landmark: "",
  city: "Palani",
  district: "Dindigul",
  state: "Tamil Nadu",
  pincode: "",
});

export function CheckoutForm({ profile, codEnabled, whatsappTransactionalAvailable }: { profile: Profile; codEnabled: boolean; whatsappTransactionalAvailable: boolean }) {
  const router = useRouter();
  const { items, couponCode, setCouponCode, ready, clear, replaceItems } = useCart();
  const [deliveryOptionId, setDeliveryOptionId] = React.useState<string | null>(null);
  const { quote, loading, error: quoteError, reload } = useQuote(items, couponCode, deliveryOptionId);
  const [step, setStep] = React.useState<"details" | "review">("details");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());
  const defaultAddress = profile.addresses.find((a) => a.isDefault) ?? profile.addresses[0];
  const [addressId, setAddressId] = React.useState<string | "new">(defaultAddress?.id ?? "new");
  const placedRef = React.useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: profile.name,
      email: profile.email,
      ...(defaultAddress
        ? { ...defaultAddress, phone: defaultAddress.phone.replace(/^\+91/, "") }
        : emptyAddress(profile)),
      instructions: "",
      saveAddress: profile.addresses.length === 0,
      whatsappOptIn: profile.preferences.whatsappOrderUpdates,
    },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState, setValue, getValues, watch } = form;

  React.useEffect(() => {
    if (quote?.deliveryOptionId && !deliveryOptionId) setDeliveryOptionId(quote.deliveryOptionId);
  }, [quote?.deliveryOptionId, deliveryOptionId]);

  function chooseAddress(id: string | "new") {
    setAddressId(id);
    const a = profile.addresses.find((x) => x.id === id);
    const values = a ? { ...a, phone: a.phone.replace(/^\+91/, "") } : emptyAddress(profile);
    for (const k of ["fullName", "phone", "line1", "line2", "landmark", "city", "district", "state", "pincode"] as const) {
      setValue(k, values[k] ?? "", { shouldValidate: formState.isSubmitted });
    }
    setValue("saveAddress", id === "new" && profile.addresses.length < 10);
  }

  if (!ready || (items.length > 0 && !quote && loading)) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (items.length === 0 && !placedRef.current) {
    return (
      <Card>
        <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Add some products before checking out." action={<Button asChild><Link href="/products">Browse products</Link></Button>} />
      </Card>
    );
  }

  const issues = (quote?.issues ?? []).filter((i) => i !== "MIN_ORDER");
  const hasLineIssues = Boolean(quote?.lines.some((l) => l.issue));
  const belowMin = Boolean(quote?.issues.includes("MIN_ORDER"));
  const blocked = !quote || quote.itemCount === 0 || hasLineIssues || belowMin || !codEnabled || !quote.codAvailable || Boolean(couponCode && quote.couponError);

  function fixCart(q: QuoteDTO) {
    replaceItems(
      q.lines.filter((l) => l.quantity > 0).map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    );
  }

  async function placeOrder() {
    if (!quote || blocked) return;
    setSubmitError(null);
    setSubmitting(true);
    const v = getValues();
    try {
      const res = await apiFetch<{ order: { id: string; orderNumber: string } }>("/api/checkout", {
        body: {
          idempotencyKey,
          items,
          couponCode,
          deliveryOptionId: deliveryOptionId ?? quote.deliveryOptionId,
          paymentMethod: "cod",
          customerName: v.customerName,
          email: v.email,
          address: {
            fullName: v.fullName,
            phone: v.phone,
            line1: v.line1,
            line2: v.line2,
            landmark: v.landmark,
            city: v.city,
            district: v.district,
            state: v.state,
            pincode: v.pincode,
          },
          instructions: v.instructions,
          saveAddress: addressId === "new" && v.saveAddress,
          whatsappOptIn: v.whatsappOptIn,
        },
      });
      placedRef.current = true;
      clear();
      router.replace(`/checkout/success/${res.order.id}`);
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "CART_CHANGED" && e.details?.quote) {
        fixCart(e.details.quote as QuoteDTO);
        setStep("details");
      }
      if (e.code === "OUT_OF_STOCK") reload();
      setSubmitError(e.message);
      toast.error(e.message);
      setSubmitting(false);
    }
  }

  const values = watch();
  const selectedDelivery = quote?.deliveryOptions.find((o) => o.id === (deliveryOptionId ?? quote.deliveryOptionId));

  return (
    <div className="grid gap-8 pb-24 md:pb-0 lg:grid-cols-[1fr_400px]">
      {quote && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 shadow-[0_-8px_24px_-12px_rgb(22_27_51/0.25)] backdrop-blur-md md:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="mr-auto min-w-0">
              <p className="text-xs text-muted-foreground">Total · {quote.itemCount} item{quote.itemCount === 1 ? "" : "s"}</p>
              <p className="font-display text-xl font-semibold tabular-nums">{formatINR(quote.total)}</p>
            </div>
            {step === "details" ? (
              <Button type="submit" form="checkout-details" size="lg" disabled={blocked}>
                Review order
              </Button>
            ) : (
              <Button size="lg" onClick={placeOrder} loading={submitting} disabled={blocked}>
                <Lock /> Place order
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="min-w-0">
        <ol className="mb-6 flex items-center gap-3 text-sm" aria-label="Checkout steps">
          <li className={cn("flex items-center gap-2 font-semibold", step === "details" ? "text-primary" : "text-muted-foreground")}>
            <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", step === "details" ? "bg-primary text-white" : "bg-success text-white")}>
              {step === "review" ? <CheckCircle2 className="size-4" /> : 1}
            </span>
            Details
          </li>
          <li className="h-px w-8 bg-border-strong" aria-hidden />
          <li className={cn("flex items-center gap-2 font-semibold", step === "review" ? "text-primary" : "text-muted-foreground")}>
            <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", step === "review" ? "bg-primary text-white" : "bg-surface-sunken")}>2</span>
            Review &amp; confirm
          </li>
        </ol>

        {quoteError && <Alert tone="danger" icon={AlertCircle} className="mb-4">{quoteError}</Alert>}
        {issues.map((m) => (
          <Alert key={m} tone="warning" icon={AlertCircle} className="mb-3">
            {m} <Link href="/cart" className="font-semibold underline">Review cart</Link>
          </Alert>
        ))}
        {belowMin && quote && <Alert tone="warning" className="mb-3">The minimum order value is {formatINR(quote.minimumOrderValue)}.</Alert>}
        {!codEnabled && <Alert tone="warning" className="mb-3">Ordering is temporarily unavailable — no payment method is enabled right now.</Alert>}
        {submitError && <Alert tone="danger" icon={AlertCircle} className="mb-4">{submitError}</Alert>}

        <AnimatePresence mode="wait" initial={false}>
          {step === "details" ? (
            <motion.form
              id="checkout-details"
              key="details"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleSubmit(() => {
                setStep("review");
                window.scrollTo({ top: 0, behavior: "smooth" });
              })}
              noValidate
              className="space-y-5"
            >
              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Contact</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field id="customerName" label="Your name" error={formState.errors.customerName?.message}>
                    <Input id="customerName" autoComplete="name" aria-invalid={Boolean(formState.errors.customerName) || undefined} {...register("customerName")} />
                  </Field>
                  {profile.phoneNumber ? (
                    <Field id="verifiedPhone" label="Verified mobile">
                      <div id="verifiedPhone" className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-muted px-3.5 text-[15px]">
                        <CheckCircle2 className="size-4 text-success" /> {formatPhoneForDisplay(profile.phoneNumber)}
                      </div>
                    </Field>
                  ) : (
                    <Field id="signedInAs" label="Signed in as">
                      <div id="signedInAs" className="flex h-11 items-center gap-2 truncate rounded-[var(--radius-md)] border border-border bg-surface-muted px-3.5 text-[15px]">
                        <CheckCircle2 className="size-4 shrink-0 text-success" /> <span className="truncate">{profile.email}</span>
                      </div>
                    </Field>
                  )}
                  <Field id="email" label="Email (optional)" error={formState.errors.email?.message} hint="For order receipts" className="sm:col-span-2">
                    <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(formState.errors.email) || undefined} {...register("email")} />
                  </Field>
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Delivery address</h2>
                {profile.addresses.length > 0 && (
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
                    {profile.addresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={addressId === a.id}
                        onClick={() => chooseAddress(a.id)}
                        className={cn(
                          "rounded-[var(--radius-lg)] border p-3.5 text-left text-sm transition-all",
                          addressId === a.id ? "border-primary bg-primary-soft/50 ring-1 ring-primary" : "border-border hover:border-border-strong",
                        )}
                      >
                        <p className="flex items-center gap-1.5 font-semibold"><MapPin className="size-4 text-primary" /> {a.label}{a.isDefault && <span className="text-xs font-normal text-muted-foreground">· Default</span>}</p>
                        <p className="mt-1 text-muted-foreground">{a.fullName}, {a.line1}, {a.city} – {a.pincode}</p>
                      </button>
                    ))}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={addressId === "new"}
                      onClick={() => chooseAddress("new")}
                      className={cn("rounded-[var(--radius-lg)] border border-dashed p-3.5 text-left text-sm font-semibold text-primary", addressId === "new" ? "border-primary bg-primary-soft/50" : "border-border-strong")}
                    >
                      + Use a new address
                    </button>
                  </div>
                )}
                <div className="mt-5">
                  <AddressFields register={register} errors={formState.errors} />
                </div>
                <div className="mt-4">
                  <Field id="instructions" label="Delivery instructions (optional)" error={formState.errors.instructions?.message}>
                    <Textarea id="instructions" rows={2} placeholder="e.g. Call before delivery" {...register("instructions")} />
                  </Field>
                </div>
                {addressId === "new" && profile.addresses.length < 10 && (
                  <label className="mt-4 flex items-center gap-2.5 text-sm">
                    <Checkbox checked={values.saveAddress} onCheckedChange={(v) => setValue("saveAddress", v === true)} />
                    Save this address for next time
                  </label>
                )}
              </Card>

              {quote && quote.deliveryOptions.length > 0 && (
                <Card className="p-5 sm:p-6">
                  <h2 className="text-lg font-semibold">Delivery option</h2>
                  <div className="mt-4 grid gap-2.5" role="radiogroup" aria-label="Delivery options">
                    {quote.deliveryOptions.map((o) => {
                      const active = (deliveryOptionId ?? quote.deliveryOptionId) === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setDeliveryOptionId(o.id)}
                          className={cn("flex items-center gap-3 rounded-[var(--radius-lg)] border p-4 text-left transition-all", active ? "border-primary bg-primary-soft/50 ring-1 ring-primary" : "border-border hover:border-border-strong")}
                        >
                          <span className={cn("flex size-5 items-center justify-center rounded-full border-2", active ? "border-primary" : "border-border-strong")}>
                            {active && <span className="size-2.5 rounded-full bg-primary" />}
                          </span>
                          <Truck className="size-5 text-primary" />
                          <span className="flex-1">
                            <span className="block text-sm font-semibold">{o.label}</span>
                            <span className="block text-xs text-muted-foreground">{o.description} · {o.etaText}</span>
                          </span>
                          <span className="text-sm font-semibold">{o.charge === 0 ? <span className="text-success">Free</span> : formatINR(o.charge)}</span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Payment</h2>
                <div className="mt-4 grid gap-2.5">
                  <div className={cn("flex items-center gap-3 rounded-[var(--radius-lg)] border p-4", codEnabled && quote?.codAvailable ? "border-primary bg-primary-soft/50 ring-1 ring-primary" : "border-border opacity-60")}>
                    <span className="flex size-5 items-center justify-center rounded-full border-2 border-primary"><span className="size-2.5 rounded-full bg-primary" /></span>
                    <Banknote className="size-5 text-primary" />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">Cash on Delivery</span>
                      <span className="block text-xs text-muted-foreground">
                        {codEnabled ? (quote?.codAvailable ? "Pay in cash or UPI when your order arrives" : "Not available for this order value") : "Currently unavailable"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border p-4 text-muted-foreground" aria-disabled>
                    <span className="size-5 rounded-full border-2 border-border-strong" />
                    <CreditCard className="size-5" />
                    <span className="flex-1 text-sm">
                      <span className="block font-semibold">Online payment</span>
                      <span className="block text-xs">Coming soon</span>
                    </span>
                  </div>
                </div>
                {whatsappTransactionalAvailable && (
                  <label className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-lg)] bg-surface-muted p-3.5 text-sm">
                    <Checkbox className="mt-0.5" checked={values.whatsappOptIn} onCheckedChange={(v) => setValue("whatsappOptIn", v === true)} />
                    <span>
                      <span className="flex items-center gap-1.5 font-medium"><MessageCircle className="size-4 text-primary" /> Send me order updates on WhatsApp</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Order confirmation and delivery status only — no promotional messages.</span>
                    </span>
                  </label>
                )}
              </Card>

              <Button type="submit" size="lg" className="hidden w-full md:inline-flex" disabled={blocked}>
                Review order
              </Button>
            </motion.form>
          ) : (
            <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Items ({quote?.itemCount})</h2>
                  <Link href="/cart" className="text-sm font-semibold text-primary">Edit cart</Link>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {quote?.lines.map((l) => (
                    <li key={l.key} className="flex items-center gap-3 py-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border">
                        <ProductImage image={l.image} name={l.name} sizes="56px" className="size-full" />
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="line-clamp-1 font-medium">{l.name}</p>
                        {l.variantName && <p className="text-xs text-muted-foreground">{l.variantName}</p>}
                        <p className="text-xs text-muted-foreground">{l.quantity} × {formatINR(l.unitPrice)}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">{formatINR(l.lineTotal)}</p>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <div>
                  <h3 className="flex items-center justify-between text-sm font-semibold">
                    Deliver to
                    <button type="button" onClick={() => setStep("details")} className="inline-flex items-center gap-1 text-primary"><Pencil className="size-3.5" /> Edit</button>
                  </h3>
                  <address className="mt-2 text-sm not-italic leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">{values.fullName}</span>
                    <br />
                    {values.line1}
                    {values.line2 && <>, {values.line2}</>}
                    {values.landmark && <><br />Landmark: {values.landmark}</>}
                    <br />
                    {values.city}, {values.district}, {values.state} – {values.pincode}
                    <br />
                    Phone: {values.phone}
                  </address>
                  {values.instructions && <p className="mt-2 text-xs text-muted-foreground">Note: {values.instructions}</p>}
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">Delivery</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedDelivery?.label} · {selectedDelivery?.etaText}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Payment method</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Cash on Delivery</p>
                  </div>
                </div>
              </Card>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button variant="outline" size="lg" onClick={() => setStep("details")} disabled={submitting}>
                  <ArrowLeft /> Back
                </Button>
                <Button size="lg" className="hidden flex-1 md:inline-flex" onClick={placeOrder} loading={submitting} disabled={blocked}>
                  <Lock /> Confirm &amp; place order · {quote ? formatINR(quote.total) : ""}
                </Button>
              </div>
              <p className="text-center text-xs text-subtle-foreground">By placing this order you agree to the store&apos;s delivery and return policies.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
          {step === "details" && <div className="mb-5"><CouponInput code={couponCode} quote={quote} onApply={setCouponCode} loading={loading} /></div>}
          {quote && <OrderSummary quote={quote} />}
          {loading && <p className="mt-3 text-center text-xs text-subtle-foreground" aria-live="polite">Updating prices…</p>}
        </Card>
      </aside>
    </div>
  );
}
