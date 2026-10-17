import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getWishlist } from "@/services/customers.service";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/display";
import { ProductCard } from "@/components/products/product-card";

export const metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/account/wishlist");
  const items = await getWishlist(customer.id);
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Wishlist</h1>
      <p className="mt-1 text-muted-foreground">{items.length} saved item{items.length === 1 ? "" : "s"}</p>
      {items.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={Heart} title="Nothing saved yet" description="Tap the heart on any product to save it for later." action={<Button asChild><Link href="/products">Explore products</Link></Button>} />
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
