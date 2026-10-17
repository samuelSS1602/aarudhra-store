import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/services/settings.service";
import { formatINR } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Card } from "@/components/ui/display";

const POLICIES = {
  delivery: { title: "Delivery information" },
  returns: { title: "Returns & cancellations" },
} as const;

type Props = { params: Promise<{ policy: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { policy } = await params;
  const p = POLICIES[policy as keyof typeof POLICIES];
  return p ? { title: p.title, alternates: { canonical: `/policies/${policy}` } } : { title: "Not found" };
}

export default async function PolicyPage({ params }: Props) {
  const { policy } = await params;
  const p = POLICIES[policy as keyof typeof POLICIES];
  if (!p) notFound();
  const c = (await getSettings()).commerce;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: p.title }]} />
      <h1 className="mb-6 mt-3 font-display text-3xl font-semibold sm:text-4xl">{p.title}</h1>
      <Card className="space-y-6 p-6 text-[15px] leading-relaxed text-muted-foreground sm:p-8">
        {policy === "delivery" ? (
          <>
            <p className="whitespace-pre-line">{c.deliveryPolicy}</p>
            <div>
              <h2 className="mb-3 font-semibold text-foreground">Delivery options</h2>
              <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border">
                {c.deliveryOptions.filter((o) => o.enabled).map((o) => (
                  <li key={o.id} className="flex justify-between gap-4 p-4 text-sm">
                    <span>
                      <span className="block font-medium text-foreground">{o.label}</span>
                      {o.description} · {o.etaText}
                    </span>
                    <span className="font-semibold text-foreground">{o.charge ? formatINR(o.charge) : "Free"}</span>
                  </li>
                ))}
              </ul>
              {c.freeDeliveryThreshold > 0 && <p className="mt-3 text-sm">Free delivery on orders of {formatINR(c.freeDeliveryThreshold)} or more.</p>}
              {c.minimumOrderValue > 0 && <p className="mt-1 text-sm">Minimum order value: {formatINR(c.minimumOrderValue)}.</p>}
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="mb-2 font-semibold text-foreground">Returns</h2>
              <p className="whitespace-pre-line">{c.returnPolicy}</p>
            </div>
            <div>
              <h2 className="mb-2 font-semibold text-foreground">Cancellations</h2>
              <p className="whitespace-pre-line">{c.cancellationPolicy}</p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
