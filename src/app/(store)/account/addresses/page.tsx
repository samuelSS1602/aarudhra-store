import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getProfile } from "@/services/customers.service";
import { AddressBook } from "@/components/account/address-book";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/account/addresses");
  const profile = await getProfile(customer.id);
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Saved addresses</h1>
      <p className="mt-1 text-muted-foreground">Save up to 10 delivery addresses for faster checkout.</p>
      <AddressBook initial={profile.addresses} defaultName={profile.name} defaultPhone={profile.phoneNumber ?? profile.contactPhone ?? ""} />
    </div>
  );
}
