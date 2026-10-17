"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, Heart, Home, LayoutGrid, LogOut, Package, Search, ShoppingBag, User, UserRound, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/components/providers/cart-provider";
import { useSession } from "@/components/providers/session-provider";
import { SearchBox } from "./search-box";

type NavCategory = { name: string; slug: string };

function CartButton({ className }: { className?: string }) {
  const { count, setDrawerOpen } = useCart();
  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className={cn("relative flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-muted", className)}
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <ShoppingBag className="size-[22px]" />
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-5 text-white"
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      )}
    </button>
  );
}

function AccountMenu() {
  const { user, status, logout } = useSession();
  if (status === "loading") return <span className="hidden h-10 w-24 md:block" aria-hidden />;
  if (!user) {
    return (
      <Link href="/login" className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground hover:bg-surface-muted md:flex">
        <UserRound className="size-5" /> Sign in
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-surface-muted md:flex">
        <UserRound className="size-5" />
        <span className="max-w-28 truncate">{user.name || "Account"}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="truncate">{user.phoneNumber ?? user.email}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/account"><User /> My account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/orders"><Package /> My orders</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/addresses"><MapPin /> Addresses</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/wishlist"><Heart /> Wishlist</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader({ storeName, categories }: { storeName: string; categories: NavCategory[] }) {
  const [scrolled, setScrolled] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md transition-shadow", scrolled ? "border-border shadow-soft" : "border-transparent")}>
      <div className="container-page flex h-16 items-center gap-3 md:h-[72px] md:gap-6">
        <Logo name={storeName} />
        <React.Suspense fallback={<div className="hidden h-11 flex-1 md:block" />}>
          <SearchBox className="hidden max-w-xl flex-1 md:block" />
        </React.Suspense>
        <div className="ml-auto flex items-center gap-0.5">
          <Link href="/account/wishlist" className="hidden size-11 items-center justify-center rounded-full hover:bg-surface-muted md:flex" aria-label="Wishlist">
            <Heart className="size-[22px]" />
          </Link>
          <AccountMenu />
          <CartButton />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <React.Suspense fallback={<div className="h-11" />}>
          <SearchBox />
        </React.Suspense>
      </div>
      <nav aria-label="Categories" className="hidden border-t border-border/70 md:block">
        <div className="container-page scrollbar-none flex h-11 items-center gap-1 overflow-x-auto text-sm">
          <Link href="/categories" className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold hover:bg-surface-muted", pathname === "/categories" && "text-primary")}>
            <LayoutGrid className="size-4" /> All categories
          </Link>
          {categories.slice(0, 9).map((c) => {
            const href = `/categories/${c.slug}`;
            return (
              <Link
                key={c.slug}
                href={href}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground", pathname === href && "bg-primary-soft text-primary-soft-foreground")}
              >
                {c.name}
              </Link>
            );
          })}
          <Link href="/products?onSale=1" className="ml-auto shrink-0 rounded-full px-3 py-1.5 font-semibold text-accent-foreground hover:bg-accent-soft">
            Special offers
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { count, setDrawerOpen } = useCart();
  const { user } = useSession();
  const [searchOpen, setSearchOpen] = React.useState(false);

  const items = [
    { href: "/", label: "Home", icon: Home, active: pathname === "/" },
    { href: "/categories", label: "Categories", icon: LayoutGrid, active: pathname.startsWith("/categories") },
  ];

  // Checkout gets its own sticky action bar instead of the tab bar.
  if (pathname === "/checkout") return null;

  const cls = (active: boolean) =>
    cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground");

  return (
    <>
      <nav aria-label="Primary" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
        <div className="flex">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className={cls(i.active)} aria-current={i.active ? "page" : undefined}>
              <i.icon className="size-[22px]" strokeWidth={i.active ? 2.4 : 2} />
              {i.label}
            </Link>
          ))}
          <button type="button" onClick={() => setSearchOpen(true)} className={cls(false)}>
            <Search className="size-[22px]" />
            Search
          </button>
          <button type="button" onClick={() => setDrawerOpen(true)} className={cn(cls(pathname === "/cart"), "relative")}>
            <span className="relative">
              <ShoppingBag className="size-[22px]" />
              {count > 0 && <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-white">{count}</span>}
            </span>
            Cart
          </button>
          <Link href={user ? "/account" : "/login"} className={cls(pathname.startsWith("/account") || pathname === "/login")}>
            <UserRound className="size-[22px]" />
            {user ? "Account" : "Sign in"}
          </Link>
        </div>
      </nav>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="bottom" title="Search products" className="min-h-[60dvh]">
          <div className="p-4">
            <React.Suspense>
              <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
            </React.Suspense>
          </div>
        </SheetContent>
      </Dialog>
    </>
  );
}
