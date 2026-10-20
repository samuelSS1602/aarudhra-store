import Link from "next/link";
import { Clock, LockKeyhole, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { StoreSettings } from "@/lib/settings-defaults";
import { formatPhoneForDisplay } from "@/lib/phone";
import { whatsappLink } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";

export function SiteFooter({ settings, categories }: { settings: StoreSettings; categories: { name: string; slug: string }[] }) {
  const g = settings.general;
  const a = g.address;
  const social = Object.entries(g.social).filter(([, url]) => url);
  return (
    <footer id="site-footer" className="mt-20 border-t border-border bg-surface pb-24 md:pb-0">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-9 py-10 md:py-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-10">
        <div className="col-span-2 lg:col-span-1">
          <Logo name={g.storeName} />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{g.description}</p>
          {social.length > 0 && (
            <div className="mt-5 flex gap-2">
              {social.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium capitalize text-muted-foreground hover:border-primary hover:text-primary">
                  {name}
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold">Shop</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {categories.slice(0, 7).map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="hover:text-primary">{c.name}</Link>
              </li>
            ))}
            <li><Link href="/products?onSale=1" className="hover:text-primary">Special offers</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Help</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li><Link href="/account/orders" className="hover:text-primary">Track your order</Link></li>
            <li><Link href="/policies/delivery" className="hover:text-primary">Delivery information</Link></li>
            <li><Link href="/policies/returns" className="hover:text-primary">Returns &amp; cancellations</Link></li>
            <li><Link href="/contact" className="hover:text-primary">Contact &amp; store location</Link></li>
            <li><Link href="/account" className="hover:text-primary">My account</Link></li>
          </ul>
        </div>

        <div className="col-span-2 lg:col-span-1">
          <h2 className="text-sm font-semibold">Visit our store</h2>
          <address className="mt-4 space-y-3 text-sm not-italic text-muted-foreground">
            <p className="flex gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                {a.line1}
                <br />
                {a.line2}
                <br />
                {a.city}, {a.state} {a.pincode}
              </span>
            </p>
            {g.storeHours && (
              <p className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{g.storeHours}</p>
            )}
            {g.supportPhone && (
              <p className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <a href={`tel:${g.supportPhone}`} className="hover:text-primary">{formatPhoneForDisplay(g.supportPhone)}</a>
              </p>
            )}
            {g.whatsappNumber && (
              <p className="flex gap-2.5">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <a href={whatsappLink(g.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="hover:text-primary">WhatsApp us</a>
              </p>
            )}
            {g.contactEmail && (
              <p className="flex gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <a href={`mailto:${g.contactEmail}`} className="hover:text-primary">{g.contactEmail}</a>
              </p>
            )}
          </address>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-3 py-5 text-xs text-subtle-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {g.storeName}, Palani. All prices in Indian Rupees (₹).</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/admin/login" className="inline-flex items-center gap-1 font-medium hover:text-primary">
              <LockKeyhole className="size-3.5" aria-hidden /> Admin login
            </Link>
            <span aria-hidden className="hidden h-3 w-px bg-border-strong md:block" />
            <p>
              Developed by{" "}
              <a href="https://www.ruthradigitalsolutions.com/" target="_blank" rel="noopener noreferrer" className="text-brand-gradient font-semibold hover:opacity-80">
                Ruthra Digital Solutions
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
