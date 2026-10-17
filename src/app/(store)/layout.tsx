import Link from "next/link";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getSettings } from "@/services/settings.service";
import { listActiveCategoriesCached } from "@/services/categories.service";
import { SessionProvider } from "@/components/providers/session-provider";
import { CartProvider } from "@/components/providers/cart-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { SiteHeader, MobileBottomNav } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { localBusinessJsonLd, JsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, customer] = await Promise.all([getSettings(), listActiveCategoriesCached(), getCurrentCustomer()]);
  const nav = categories.map((c) => ({ name: c.name, slug: c.slug }));
  const announcement = settings.homepage.announcement;

  return (
    <SessionProvider initialUser={customer ? { id: customer.id, name: customer.name, phoneNumber: customer.phoneNumber, email: customer.email } : null}>
      <CartProvider>
        <MotionProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white">
            Skip to content
          </a>
          {announcement.enabled && announcement.text && (
            <div className="bg-primary text-primary-foreground">
              <div className="container-page flex h-9 items-center justify-center text-center text-[13px] font-medium">
                {announcement.href ? (
                  <Link href={announcement.href} className="truncate hover:underline">{announcement.text}</Link>
                ) : (
                  <span className="truncate">{announcement.text}</span>
                )}
              </div>
            </div>
          )}
          <SiteHeader storeName={settings.general.storeName} categories={nav} />
          <main id="main" className="min-h-[60vh]">{children}</main>
          <SiteFooter settings={settings} categories={nav} />
          <MobileBottomNav />
          <CartDrawer />
          <JsonLd data={localBusinessJsonLd(settings)} />
        </MotionProvider>
      </CartProvider>
    </SessionProvider>
  );
}
