import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { getEnv } from "@/lib/env";
import { getSettings } from "@/services/settings.service";
import { listAllCategories } from "@/services/categories.service";
import { PageHeader } from "@/components/admin/ui";
import { SettingsEditor } from "@/components/admin/settings-editor";

export const metadata = { title: "Store settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminPage("settings:write");
  const [settings, categories, { tab }] = await Promise.all([getSettings(), listAllCategories(), searchParams]);
  const env = getEnv();
  return (
    <div>
      <PageHeader title="Store settings" description="Changes are saved to the database and applied across the store immediately." />
      <SettingsEditor
        initial={settings}
        initialTab={tab ?? "general"}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        canSecurity={can(admin.role, "settings:security")}
        envDefaults={{ ownerNumber: env.WHATSAPP_OWNER_NUMBER ?? "", ownerTemplate: env.WHATSAPP_TEMPLATE_NAME ?? "", language: env.WHATSAPP_TEMPLATE_LANGUAGE }}
      />
    </div>
  );
}
