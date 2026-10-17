"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="This page couldn't load"
      description={error.digest ? `Something went wrong (ref ${error.digest}). Check the server logs or try again.` : "Something went wrong. Please try again."}
      action={<Button onClick={reset}><RefreshCw /> Retry</Button>}
    />
  );
}
