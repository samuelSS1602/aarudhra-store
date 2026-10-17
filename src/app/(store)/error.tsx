"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";

export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="We couldn't load this page right now. Please try again in a moment."
        action={<Button onClick={reset}><RefreshCw /> Try again</Button>}
      />
    </div>
  );
}
