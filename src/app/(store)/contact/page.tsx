import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { getSettings, storeAddressLines } from "@/services/settings.service";
import { formatPhoneForDisplay } from "@/lib/phone";
import { whatsappLink } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export const metadata: Metadata = {
  title: "Contact & store location",
  description: "Visit Aarudhra Smart Store at New Ammumall Complex, New Dharapuram Road, opposite Town Police Station, Indra Nagar, Palani, Tamil Nadu 624601.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const s = await getSettings();
  const g = s.general;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.mapQuery)}`;
  const hasContact = g.supportPhone || g.whatsappNumber || g.contactEmail;
  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Contact" }]} />
      <h1 className="mb-8 mt-3 font-display text-3xl font-semibold sm:text-4xl">Contact &amp; store location</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-5 text-primary" /> {g.storeName}</h2>
            <address className="mt-3 space-y-0.5 text-[15px] not-italic leading-relaxed text-muted-foreground">
              {storeAddressLines(s).map((l) => <p key={l}>{l}</p>)}
            </address>
            {g.storeHours && <p className="mt-4 flex items-center gap-2 text-sm"><Clock className="size-4 text-primary" /> {g.storeHours}</p>}
            <Button asChild variant="outline" className="mt-5">
              <a href={directions} target="_blank" rel="noopener noreferrer"><Navigation /> Get directions</a>
            </Button>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold">Get in touch</h2>
            {hasContact ? (
              <ul className="mt-4 space-y-3 text-sm">
                {g.whatsappNumber && (
                  <li>
                    <a href={whatsappLink(g.whatsappNumber, "Hello Aarudhra Smart Store!")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 font-medium text-primary hover:underline">
                      <MessageCircle className="size-4" /> Chat on WhatsApp
                    </a>
                  </li>
                )}
                {g.supportPhone && (
                  <li>
                    <a href={`tel:${g.supportPhone}`} className="flex items-center gap-2.5 hover:text-primary"><Phone className="size-4 text-primary" /> {formatPhoneForDisplay(g.supportPhone)}</a>
                  </li>
                )}
                {g.contactEmail && (
                  <li>
                    <a href={`mailto:${g.contactEmail}`} className="flex items-center gap-2.5 hover:text-primary"><Mail className="size-4 text-primary" /> {g.contactEmail}</a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Please visit us at the store. Phone and WhatsApp contact details will be listed here soon.</p>
            )}
          </Card>
        </div>
        <div className="relative min-h-80 overflow-hidden rounded-[var(--radius-2xl)] border border-border bg-surface-muted">
          <iframe
            title={`Map showing ${g.storeName}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(g.mapQuery)}&output=embed`}
            className="absolute inset-0 size-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
