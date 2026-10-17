import { NOTIFICATION_STATUS_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/display";

export function NotificationBadge({ status }: { status: string }) {
  const tone =
    status === "delivered" || status === "read" ? "success" : status === "sent" ? "info" : status === "failed" ? "danger" : status === "disabled" ? "neutral" : "warning";
  return <Badge tone={tone}>{NOTIFICATION_STATUS_LABELS[status] ?? status}</Badge>;
}
