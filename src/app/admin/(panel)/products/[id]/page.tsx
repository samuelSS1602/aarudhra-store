import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { getAdminProduct } from "@/services/products.service";
import { listAllCategories } from "@/services/categories.service";
import { getSettings } from "@/services/settings.service";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("products:view");
  const { id } = await params;
  const product = await getAdminProduct(id, admin).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const [categories, settings] = await Promise.all([listAllCategories(), getSettings()]);
  return (
    <div>
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku} · ${product.salesCount} sold`}
        actions={product.status === "active" && (
          <Button asChild variant="outline"><Link href={`/products/${product.slug}`} target="_blank"><ExternalLink /> View in store</Link></Button>
        )}
      />
      <ProductForm
        product={product}
        categories={categories}
        canSeeCost={can(admin.role, "products:cost")}
        canDelete={can(admin.role, "products:delete")}
        defaultGstRate={settings.commerce.defaultGstRate}
        defaultTaxInclusive={settings.commerce.taxMode === "inclusive"}
        defaultLowStock={settings.commerce.lowStockThreshold}
      />
    </div>
  );
}
