import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="mb-6 font-display text-3xl font-semibold sm:text-4xl">Your cart</h1>
      <CartView />
    </div>
  );
}
