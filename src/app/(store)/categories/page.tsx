import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { listActiveCategoriesCached } from "@/services/categories.service";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DynamicIcon } from "@/components/storefront/icons";
import { EmptyState } from "@/components/ui/display";

export const metadata: Metadata = {
  title: "Shop by category",
  description: "Explore school stationery, office supplies, art & craft, kitchen, cleaning and home essentials at Aarudhra Smart Store.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await listActiveCategoriesCached();
  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Categories" }]} />
      <h1 className="mb-8 mt-3 font-display text-3xl font-semibold sm:text-4xl">Shop by category</h1>
      {categories.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No categories yet" description="Categories will appear here once the store adds them." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="group flex items-center gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
            >
              <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
                {c.image?.url ? <Image src={c.image.url} alt="" fill sizes="64px" className="object-cover" /> : <DynamicIcon name={c.icon} className="size-7" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{c.name}</h2>
                {c.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                <p className="mt-1 text-xs text-subtle-foreground">{c.productCount ?? 0} products</p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
