import {
  BadgeIndianRupee,
  Backpack,
  Boxes,
  Briefcase,
  Brush,
  ChefHat,
  Gift,
  HandCoins,
  Home,
  NotebookPen,
  Package,
  Palette,
  PenTool,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  SprayCan,
  Store,
  Tag,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Whitelisted icon names usable from admin-managed content (categories, highlights). */
export const ICONS: Record<string, LucideIcon> = {
  Backpack,
  NotebookPen,
  PenTool,
  Briefcase,
  Palette,
  Brush,
  Home,
  ChefHat,
  SprayCan,
  Boxes,
  Wrench,
  ShoppingBasket,
  Tag,
  Gift,
  Package,
  Sparkles,
  BadgeIndianRupee,
  Truck,
  HandCoins,
  Store,
  ShieldCheck,
};

export const ICON_NAMES = Object.keys(ICONS);

export function DynamicIcon({ name, className }: { name: string | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Package;
  return <Icon className={className} aria-hidden />;
}
