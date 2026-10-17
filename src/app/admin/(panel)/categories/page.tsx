import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { listAllCategories } from "@/services/categories.service";
import { PageHeader } from "@/components/admin/ui";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata = { title: "Categories" };

export default async function CategoriesAdminPage() {
  const admin = await requireAdminPage("products:view");
  const categories = await listAllCategories();
  return (
    <div>
      <PageHeader title="Categories" description="Create, reorder and disable storefront categories." />
      <CategoryManager initial={categories} canWrite={can(admin.role, "categories:write")} />
    </div>
  );
}
