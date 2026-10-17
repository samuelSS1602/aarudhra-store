import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getProfile } from "@/services/customers.service";
import { getSettings } from "@/services/settings.service";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/checkout");
  const [profile, settings] = await Promise.all([getProfile(customer.id), getSettings()]);

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-6 font-display text-3xl font-semibold sm:text-4xl">Checkout</h1>
      <CheckoutForm
        profile={profile}
        codEnabled={settings.commerce.codEnabled}
        whatsappTransactionalAvailable={settings.notifications.customerOrderConfirmation || settings.notifications.customerStatusUpdates}
      />
    </div>
  );
}
