import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { listAllCategories } from "@/services/categories.service";
import { getSettings } from "@/services/settings.service";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/display";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { FolderTree } from "lucide-react";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const admin = await requireAdminPage("products:write");
  const [categories, settings] = await Promise.all([listAllCategories(), getSettings()]);
  return (
    <div>
      <PageHeader title="Add product" />
      {categories.length === 0 ? (
        <Card>
          <EmptyState icon={FolderTree} title="Create a category first" description="Every product belongs to a category." action={<Button asChild><Link href="/admin/categories">Manage categories</Link></Button>} />
        </Card>
      ) : (
        <ProductForm
          categories={categories}
          canSeeCost={can(admin.role, "products:cost")}
          canDelete={false}
          defaultGstRate={settings.commerce.defaultGstRate}
          defaultTaxInclusive={settings.commerce.taxMode === "inclusive"}
          defaultLowStock={settings.commerce.lowStockThreshold}
        />
      )}
    </div>
  );
}
