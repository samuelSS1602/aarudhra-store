"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client-api";
import { Button } from "@/components/ui/button";

export function ProcessQueueButton() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      variant="outline"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await apiFetch<{ processed: number; found: number }>("/api/admin/notifications/process", { method: "POST", body: {} });
          toast.success(r.found ? `Processed ${r.processed} of ${r.found} queued notification(s)` : "No notifications are due for retry");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      <RotateCw /> Run retry queue
    </Button>
  );
}
