import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/constants";

export type ImageDTO = { url: string; publicId?: string; alt?: string; width?: number; height?: number };

export type CategoryDTO = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: ImageDTO | null;
  icon: string;
  displayOrder: number;
  status: "active" | "inactive";
  productCount?: number;
};

export type VariantDTO = {
  id: string;
  name: string;
  sku: string;
  options: { name: string; value: string }[];
  price: number | null;
  originalPrice: number | null;
  stock: number;
  status: "active" | "inactive";
};

export type ProductCardDTO = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  image: ImageDTO | null;
  /** Up to 6 photos for the card (url + alt). Optional: older cached entries lack it. */
  images?: ImageDTO[];
  price: number;
  originalPrice: number | null;
  discountPercent: number;
  stock: number;
  lowStockThreshold: number;
  hasVariants: boolean;
  categoryName?: string;
  categorySlug?: string;
};

export type ProductDetailDTO = ProductCardDTO & {
  sku: string;
  description: string;
  images: ImageDTO[];
  category: { id: string; name: string; slug: string } | null;
  variants: VariantDTO[];
  specifications: { label: string; value: string }[];
  tags: string[];
  tax: { gstRate: number; inclusive: boolean };
  seo: { title: string; description: string };
  weightGrams: number | null;
  updatedAt: string;
};

export type AdminProductDTO = ProductDetailDTO & {
  status: "active" | "draft" | "archived";
  featured: boolean;
  costPrice: number | null;
  barcode: string;
  dimensions: { lengthCm?: number; widthCm?: number; heightCm?: number } | null;
  tax: { gstRate: number; inclusive: boolean; hsnCode: string };
  salesCount: number;
  isDemo: boolean;
  createdAt: string;
};

export type CartLineDTO = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  slug: string;
  sku: string;
  image: ImageDTO | null;
  unitPrice: number;
  originalPrice: number | null;
  quantity: number;
  requestedQuantity: number;
  available: number;
  lineTotal: number;
  issue: "out_of_stock" | "insufficient_stock" | "unavailable" | null;
};

export type QuoteDTO = {
  lines: CartLineDTO[];
  itemCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  taxIncluded: number;
  deliveryCharge: number;
  total: number;
  coupon: { code: string; description: string; discountAmount: number } | null;
  couponError: string | null;
  deliveryOptions: { id: string; label: string; description: string; charge: number; etaText: string; free: boolean }[];
  deliveryOptionId: string | null;
  freeDeliveryThreshold: number;
  amountToFreeDelivery: number;
  minimumOrderValue: number;
  codEnabled: boolean;
  codAvailable: boolean;
  issues: string[];
};

export type AddressDTO = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type OrderItemDTO = {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  slug: string | null;
  image: string | null;
  unitPrice: number;
  originalPrice: number | null;
  quantity: number;
  lineTotal: number;
  gstRate: number;
  taxInclusive: boolean;
};

export type OrderDTO = {
  id: string;
  orderNumber: string;
  userId: string;
  customer: { name: string; phone: string; email: string | null };
  items: OrderItemDTO[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string;
    landmark: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    instructions: string;
  };
  subtotal: number;
  discount: number;
  tax: number;
  taxIncluded: number;
  deliveryCharge: number;
  totalAmount: number;
  deliveryOption: { id: string; label: string; etaText: string } | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  coupon: { code: string; discountAmount: number } | null;
  statusHistory: { status: OrderStatus; at: string; by: { type: string; name?: string } | null; note: string | null }[];
  cancellation: { reason: string; at: string } | null;
  refund: { amount: number; reason: string; reference: string; at: string } | null;
  whatsappOptIn: boolean;
  ownerNotificationStatus: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
};

export type AdminOrderDTO = OrderDTO & {
  internalNotes: { id: string; note: string; adminName: string; at: string }[];
};

export type ApiErrorBody = {
  error: { code: string; message: string; details?: { fieldErrors?: Record<string, string>; [k: string]: unknown } };
};
