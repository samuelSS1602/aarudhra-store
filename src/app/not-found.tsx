import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <Logo />
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <div className="flex gap-2">
            <Button asChild><Link href="/">Go home</Link></Button>
            <Button asChild variant="outline"><Link href="/products">Browse products</Link></Button>
          </div>
        }
      />
    </div>
  );
}
