import { ProductCardSkeleton } from "@/components/products/product-card";

export default function StoreLoading() {
  return (
    <div className="container-page py-8" aria-busy aria-label="Loading">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-4 h-9 w-64" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
