import { redirect } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getProfile } from "@/services/customers.service";
import { Alert } from "@/components/ui/display";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata = { title: "Profile" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/account");
  const [profile, { welcome }] = await Promise.all([getProfile(customer.id), searchParams]);
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Profile</h1>
      <p className="mt-1 text-muted-foreground">Manage your details and communication preferences.</p>
      {welcome && (
        <Alert tone="success" icon={PartyPopper} title="Welcome to Aarudhra Smart Store!" className="mt-5">
          Your account is ready. Add your name below so we know who to deliver to.
        </Alert>
      )}
      <ProfileForm profile={profile} />
    </div>
  );
}
