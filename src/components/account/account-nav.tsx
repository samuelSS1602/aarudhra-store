"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LogOut, MapPin, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";

const LINKS = [
  { href: "/account", label: "Profile", icon: User, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
];

export function AccountNav() {
  const pathname = usePathname();
  const { logout } = useSession();
  return (
    <nav aria-label="Account" className="scrollbar-none mt-4 flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <l.icon className="size-4" /> {l.label}
          </Link>
        );
      })}
      <button type="button" onClick={() => void logout()} className="flex shrink-0 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-danger-soft hover:text-danger">
        <LogOut className="size-4" /> Sign out
      </button>
    </nav>
  );
}
