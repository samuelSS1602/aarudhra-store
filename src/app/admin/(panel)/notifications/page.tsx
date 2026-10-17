import Link from "next/link";
import { CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { getEnv, isWhatsAppConfigured } from "@/lib/env";
import { NOTIFICATION_STATUS_LABELS, NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime, maskPhone } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone";
import { listNotifications } from "@/services/notifications.service";
import { getSettings, resolveOwnerRecipients } from "@/services/settings.service";
import { Alert, Card, CardContent, EmptyState } from "@/components/ui/display";
import { PageHeader, Pagination, StatTile, Table, TableCard, Td, Th, hrefWith } from "@/components/admin/ui";
import { AutoRefresh, SearchFilter, SelectFilter } from "@/components/admin/filters";
import { NotificationBadge } from "@/components/admin/notification-badge";
import { RetryNotificationButton } from "@/components/admin/order-actions";
import { ProcessQueueButton } from "@/components/admin/process-queue-button";

export const metadata = { title: "WhatsApp notifications" };

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-danger" />}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdminPage("notifications:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, total, counts }, settings] = await Promise.all([
    listNotifications({ status: sp.status, type: sp.type, q: sp.q, page, pageSize: 25 }),
    getSettings(),
  ]);
  const env = getEnv();
  const recipients = resolveOwnerRecipients(settings);
  const ownerTemplate = settings.notifications.ownerTemplateName || env.WHATSAPP_TEMPLATE_NAME;
  const pii = can(admin.role, "customers:pii");

  return (
    <div>
      <AutoRefresh intervalMs={20_000} />
      <PageHeader
        title="WhatsApp notifications"
        description="Order alerts sent through the official WhatsApp Business Cloud API."
        actions={can(admin.role, "notifications:retry") && <ProcessQueueButton />}
      />

      <Card className="mb-5">
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2 sm:pt-6 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-semibold">Integration status</p>
            <ul className="space-y-1.5">
              <Check ok={isWhatsAppConfigured()} label="Cloud API credentials (access token + phone number ID)" />
              <Check ok={recipients.length > 0} label={`Owner recipient${recipients.length > 1 ? "s" : ""}: ${recipients.length ? recipients.map(formatPhoneForDisplay).join(", ") : "not set"}`} />
              <Check ok={settings.notifications.ownerMessageMode === "text" || Boolean(ownerTemplate)} label={settings.notifications.ownerMessageMode === "text" ? "Owner alerts use free-form text (24h window)" : `Owner template: ${ownerTemplate || "not set"}`} />
              <Check ok={Boolean(env.WHATSAPP_APP_SECRET && env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)} label="Webhook secret & verify token (delivery receipts)" />
              <Check ok={Boolean(env.CRON_SECRET)} label="CRON_SECRET (automatic retries)" />
            </ul>
          </div>
          <div className="text-sm text-muted-foreground lg:col-span-2">
            <p><strong className="text-foreground">Sent to provider</strong> means WhatsApp accepted the message — not that it reached the phone. <strong className="text-foreground">Delivered</strong> and <strong className="text-foreground">Read</strong> are confirmed only by Meta&apos;s webhook callbacks.</p>
            <p className="mt-2">Failed messages with temporary errors are retried automatically with back-off. Messages already accepted by WhatsApp are never re-sent, to avoid duplicates. Change recipients and templates in <Link href="/admin/settings?tab=notifications" className="font-medium text-primary">Store settings</Link>.</p>
          </div>
        </CardContent>
      </Card>
      {!isWhatsAppConfigured() && (
        <Alert tone="warning" title="WhatsApp is not configured" className="mb-5">
          Orders are still saved and appear on the dashboard; notifications are logged as failed until credentials are added. See README → WhatsApp setup.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
        {(["queued", "sent", "delivered", "read", "failed"] as const).map((s) => (
          <StatTile key={s} label={NOTIFICATION_STATUS_LABELS[s]!} value={(counts[s] ?? 0) + (s === "queued" ? counts.pending ?? 0 : 0)} href={`/admin/notifications?status=${s}`} tone={s === "failed" && counts[s] ? "danger" : "default"} />
        ))}
      </div>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        <SearchFilter placeholder="Order number…" />
        <SelectFilter param="status" label="Any status" options={["pending", "queued", "sent", "delivered", "read", "failed"].map((s) => ({ value: s, label: NOTIFICATION_STATUS_LABELS[s]! }))} />
        <SelectFilter param="type" label="Any type" options={Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      <TableCard>
        {items.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No notifications yet" description="A notification is recorded for every new order." />
        ) : (
          <Table>
            <thead><tr><Th>Type</Th><Th>Order</Th><Th>Recipient</Th><Th>Created</Th><Th>Status</Th><Th className="text-right">Attempts</Th><Th>Provider message ID / error</Th><Th /></tr></thead>
            <tbody>
              {items.map((n) => (
                <tr key={String(n._id)}>
                  <Td className="text-xs">{NOTIFICATION_TYPE_LABELS[n.type]}</Td>
                  <Td>{n.orderId ? <Link href={`/admin/orders/${n.orderId}`} className="font-mono text-sm text-primary hover:underline">{n.orderNumber}</Link> : "—"}</Td>
                  <Td className="text-xs">{pii ? formatPhoneForDisplay(n.recipient) : maskPhone(n.recipient)}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                    {n.deliveredAt && <span className="block text-success">Delivered {formatDateTime(n.deliveredAt)}</span>}
                  </Td>
                  <Td><NotificationBadge status={n.status} /></Td>
                  <Td className="text-right tabular-nums">{n.attempts}/{n.maxAttempts}</Td>
                  <Td className="max-w-72 text-xs">
                    {n.providerMessageId && <span className="block truncate font-mono text-muted-foreground" title={n.providerMessageId}>{n.providerMessageId}</span>}
                    {n.errorMessage && n.status !== "sent" && n.status !== "delivered" && n.status !== "read" && <span className="block text-danger">[{n.errorCode}] {n.errorMessage}</span>}
                    {n.status === "queued" && n.nextAttemptAt && <span className="block text-muted-foreground">Next try {formatDateTime(n.nextAttemptAt)}</span>}
                  </Td>
                  <Td>{n.status === "failed" && can(admin.role, "notifications:retry") && <RetryNotificationButton id={String(n._id)} />}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableCard>
      <Pagination page={page} total={total} pageSize={25} buildHref={(p) => hrefWith("/admin/notifications", sp, { page: p })} />
    </div>
  );
}
