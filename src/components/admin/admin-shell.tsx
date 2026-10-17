"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronsLeft,
  ClipboardList,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  TicketPercent,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { can, ROLE_LABELS, type Permission, type StaffRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client-api";
import { LogoMark } from "@/components/layout/logo";
import { Dialog, SheetContent } from "@/components/ui/dialog";

type NavItem = { href: string; label: string; icon: LucideIcon; permission: Permission; badge?: "orders" | "notifications" };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, permission: "dashboard:view" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "products:view" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "products:view" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory:view" },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, permission: "orders:view", badge: "orders" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers:view" },
  { href: "/admin/addresses", label: "Customer addresses", icon: MapPin, permission: "customers:pii" },
  { href: "/admin/coupons", label: "Coupons & discounts", icon: TicketPercent, permission: "coupons:write" },
  { href: "/admin/analytics", label: "Sales analytics", icon: BarChart3, permission: "analytics:view" },
  { href: "/admin/notifications", label: "WhatsApp notifications", icon: MessageCircle, permission: "notifications:view", badge: "notifications" },
  { href: "/admin/settings", label: "Store settings", icon: Settings, permission: "settings:write" },
  { href: "/admin/admins", label: "Admin users", icon: ShieldCheck, permission: "admins:manage" },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText, permission: "audit:view" },
];

type Summary = { pendingOrders: number; failedNotifications: number; latestOrder: { orderNumber: string; createdAt: string } | null };

/** Polls a lightweight endpoint so new orders surface without a manual refresh. */
function useLiveSummary(enabled: boolean) {
  const router = useRouter();
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const lastSeen = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const s = await apiFetch<Summary>("/api/admin/summary");
        if (stopped) return;
        setSummary(s);
        const latest = s.latestOrder?.orderNumber ?? null;
        if (lastSeen.current && latest && latest !== lastSeen.current) {
          toast.success(`New order ${latest}`, { action: { label: "View", onClick: () => router.push("/admin/orders") } });
          router.refresh();
        }
        lastSeen.current = latest;
      } catch {
        /* transient; next tick retries */
      }
    };
    void tick();
    const id = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, router]);
  return summary;
}

function NavList({ role, collapsed, summary, onNavigate }: { role: StaffRole; collapsed: boolean; summary: Summary | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {NAV.filter((n) => can(role, n.permission)).map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        const count = n.badge === "orders" ? summary?.pendingOrders : n.badge === "notifications" ? summary?.failedNotifications : 0;
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={onNavigate}
              title={collapsed ? n.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
                collapsed && "justify-center px-0",
              )}
            >
              {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-lime" />}
              <n.icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{n.label}</span>}
              {!!count && (
                <span className={cn("ml-auto rounded-full px-1.5 text-[11px] font-bold leading-5", n.badge === "notifications" ? "bg-danger text-white" : "bg-accent text-white", collapsed && "absolute right-1 top-1 ml-0")}>
                  {count}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function crumbsFor(pathname: string) {
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const labels: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.href.split("/")[2] ?? "", n.label]));
  const crumbs = [{ href: "/admin", label: "Dashboard" }];
  let acc = "/admin";
  for (const p of parts) {
    acc += `/${p}`;
    crumbs.push({ href: acc, label: labels[p] ?? (p === "new" ? "New" : p === "invoice" ? "Invoice" : /^[a-f0-9]{24}$/.test(p) ? "Details" : p) });
  }
  return crumbs;
}

export function AdminShell({ admin, children }: { admin: { name: string; email: string; role: StaffRole }; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const summary = useLiveSummary(can(admin.role, "dashboard:view"));
  const crumbs = crumbsFor(pathname);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("aas_admin_sidebar") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("aas_admin_sidebar", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  async function logout() {
    await apiFetch("/api/admin/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  const sidebarInner = (isCollapsed: boolean, onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center gap-2.5 px-4", isCollapsed && "justify-center px-0")}>
        <LogoMark tile className="size-9" />
        {!isCollapsed && (
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold text-white">Aarudhra</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime">Admin</p>
          </div>
        )}
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-2">
        <NavList role={admin.role} collapsed={isCollapsed} summary={summary} onNavigate={onNavigate} />
      </nav>
      <div className="border-t border-white/10 p-3">
        <button type="button" onClick={logout} className={cn("flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/8 hover:text-white", isCollapsed && "justify-center px-0")}>
          <LogOut className="size-[18px]" /> {!isCollapsed && "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      <motion.aside
        animate={{ width: collapsed ? 76 : 256 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="no-print fixed inset-y-0 left-0 z-30 hidden bg-[#121a4a] lg:block"
      >
        {sidebarInner(collapsed)}
        <button
          type="button"
          onClick={toggle}
          className="absolute -right-3 top-20 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-soft hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
      </motion.aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" title="Menu" className="bg-[#121a4a] text-white [&>div:first-child]:border-white/10">
          {sidebarInner(false, () => setMobileOpen(false))}
        </SheetContent>
      </Dialog>

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <button type="button" className="rounded-md p-2 hover:bg-surface-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 truncate text-sm">
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex items-center gap-1.5 truncate">
                  {i > 0 && <span className="text-subtle-foreground">/</span>}
                  {i === crumbs.length - 1 ? <span className="truncate font-semibold">{c.label}</span> : <Link href={c.href} className="text-muted-foreground hover:text-foreground">{c.label}</Link>}
                </li>
              ))}
            </ol>
          </nav>
          <AnimatePresence>
            {summary && summary.pendingOrders > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Link href="/admin/orders?status=pending" className="hidden items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-foreground sm:flex">
                  <Bell className="size-3.5" /> {summary.pendingOrders} pending
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-surface-muted md:flex">
            <ExternalLink className="size-4" /> View store
          </Link>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-semibold">{admin.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[admin.role]}</p>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
