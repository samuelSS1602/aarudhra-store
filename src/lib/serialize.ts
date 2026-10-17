import type { Types } from "mongoose";
import type {
  AddressDTO,
  AdminOrderDTO,
  AdminProductDTO,
  CategoryDTO,
  ImageDTO,
  OrderDTO,
  ProductCardDTO,
  ProductDetailDTO,
  VariantDTO,
} from "@/types";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/constants";

/* Mappers from lean Mongo documents to plain, client-safe DTOs. */

type AnyDoc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const id = (v: Types.ObjectId | string | undefined | null) => (v ? String(v) : "");
const iso = (d: Date | string | undefined | null) => (d ? new Date(d).toISOString() : null);

function image(i: AnyDoc | null | undefined): ImageDTO | null {
  if (!i?.url) return null;
  return { url: i.url, publicId: i.publicId, alt: i.alt ?? "", width: i.width, height: i.height };
}

export function toCategoryDTO(c: AnyDoc, productCount?: number): CategoryDTO {
  return {
    id: id(c._id),
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    image: image(c.image),
    icon: c.icon ?? "",
    displayOrder: c.displayOrder ?? 0,
    status: c.status,
    ...(productCount !== undefined ? { productCount } : {}),
  };
}

function toVariantDTO(v: AnyDoc): VariantDTO {
  return {
    id: id(v._id),
    name: v.name,
    sku: v.sku,
    options: (v.options ?? []).map((o: AnyDoc) => ({ name: o.name, value: o.value })),
    price: v.price ?? null,
    originalPrice: v.originalPrice ?? null,
    stock: v.stock ?? 0,
    status: v.status ?? "active",
  };
}

export function toProductCardDTO(p: AnyDoc): ProductCardDTO {
  const cat = p.categoryId && typeof p.categoryId === "object" && "name" in p.categoryId ? p.categoryId : null;
  const activeVariants = (p.variants ?? []).filter((v: AnyDoc) => v.status !== "inactive");
  return {
    id: id(p._id),
    name: p.name,
    slug: p.slug,
    brand: p.brand ?? "",
    image: image(p.images?.[0]),
    price: p.price,
    originalPrice: p.originalPrice ?? null,
    discountPercent: p.discountPercent ?? 0,
    stock: activeVariants.length
      ? activeVariants.reduce((s: number, v: AnyDoc) => s + (v.stock ?? 0), 0)
      : p.stock ?? 0,
    lowStockThreshold: p.lowStockThreshold ?? 5,
    hasVariants: activeVariants.length > 0,
    ...(cat ? { categoryName: cat.name, categorySlug: cat.slug } : {}),
  };
}

export function toProductDetailDTO(p: AnyDoc): ProductDetailDTO {
  const cat = p.categoryId && typeof p.categoryId === "object" && "name" in p.categoryId ? p.categoryId : null;
  return {
    ...toProductCardDTO(p),
    sku: p.sku,
    description: p.description ?? "",
    images: (p.images ?? []).map(image).filter(Boolean) as ImageDTO[],
    category: cat ? { id: id(cat._id), name: cat.name, slug: cat.slug } : null,
    variants: (p.variants ?? []).filter((v: AnyDoc) => v.status !== "inactive").map(toVariantDTO),
    specifications: (p.specifications ?? []).map((s: AnyDoc) => ({ label: s.label, value: s.value })),
    tags: p.tags ?? [],
    tax: { gstRate: p.tax?.gstRate ?? 0, inclusive: p.tax?.inclusive ?? true },
    seo: { title: p.seo?.title ?? "", description: p.seo?.description ?? "" },
    weightGrams: p.weightGrams ?? null,
    updatedAt: iso(p.updatedAt) ?? "",
  };
}

export function toAdminProductDTO(p: AnyDoc, includeCost: boolean): AdminProductDTO {
  const detail = toProductDetailDTO(p);
  return {
    ...detail,
    categoryName: detail.category?.name,
    variants: (p.variants ?? []).map(toVariantDTO),
    status: p.status,
    featured: Boolean(p.featured),
    costPrice: includeCost ? (p.costPrice ?? null) : null,
    barcode: p.barcode ?? "",
    dimensions: p.dimensions ?? null,
    tax: { gstRate: p.tax?.gstRate ?? 0, inclusive: p.tax?.inclusive ?? true, hsnCode: p.tax?.hsnCode ?? "" },
    salesCount: p.salesCount ?? 0,
    isDemo: Boolean(p.isDemo),
    createdAt: iso(p.createdAt) ?? "",
  };
}

export function toAddressDTO(a: AnyDoc): AddressDTO {
  return {
    id: id(a._id),
    label: a.label ?? "Home",
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    landmark: a.landmark ?? "",
    city: a.city,
    district: a.district,
    state: a.state,
    pincode: a.pincode,
    isDefault: Boolean(a.isDefault),
  };
}

export function toOrderDTO(o: AnyDoc): OrderDTO {
  return {
    id: id(o._id),
    orderNumber: o.orderNumber,
    userId: id(o.userId),
    customer: { name: o.customerSnapshot?.name, phone: o.customerSnapshot?.phone, email: o.customerSnapshot?.email ?? null },
    items: (o.items ?? []).map((i: AnyDoc) => ({
      productId: id(i.productId),
      variantId: i.variantId ? id(i.variantId) : null,
      name: i.name,
      variantName: i.variantName ?? null,
      sku: i.sku,
      slug: i.slug ?? null,
      image: i.image ?? null,
      unitPrice: i.unitPrice,
      originalPrice: i.originalPrice ?? null,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
      gstRate: i.gstRate ?? 0,
      taxInclusive: i.taxInclusive ?? true,
    })),
    shippingAddress: {
      fullName: o.shippingAddress?.fullName ?? "",
      phone: o.shippingAddress?.phone ?? "",
      line1: o.shippingAddress?.line1 ?? "",
      line2: o.shippingAddress?.line2 ?? "",
      landmark: o.shippingAddress?.landmark ?? "",
      city: o.shippingAddress?.city ?? "",
      district: o.shippingAddress?.district ?? "",
      state: o.shippingAddress?.state ?? "",
      pincode: o.shippingAddress?.pincode ?? "",
      instructions: o.shippingAddress?.instructions ?? "",
    },
    subtotal: o.subtotal,
    discount: o.discount ?? 0,
    tax: o.tax ?? 0,
    taxIncluded: o.taxIncluded ?? 0,
    deliveryCharge: o.deliveryCharge ?? 0,
    totalAmount: o.totalAmount,
    deliveryOption: o.deliveryOption?.id
      ? { id: o.deliveryOption.id, label: o.deliveryOption.label, etaText: o.deliveryOption.etaText ?? "" }
      : null,
    paymentMethod: o.paymentMethod as PaymentMethod,
    paymentStatus: o.paymentStatus as PaymentStatus,
    orderStatus: o.orderStatus as OrderStatus,
    coupon: o.couponSnapshot?.code ? { code: o.couponSnapshot.code, discountAmount: o.couponSnapshot.discountAmount ?? 0 } : null,
    statusHistory: (o.statusHistory ?? []).map((h: AnyDoc) => ({
      status: h.status,
      at: iso(h.at) ?? "",
      by: h.by ? { type: h.by.type, name: h.by.type === "admin" ? "Store team" : h.by.name } : null,
      note: h.note ?? null,
    })),
    cancellation: o.cancellation?.at ? { reason: o.cancellation.reason ?? "", at: iso(o.cancellation.at)! } : null,
    refund: o.refund?.at
      ? { amount: o.refund.amount ?? 0, reason: o.refund.reason ?? "", reference: o.refund.reference ?? "", at: iso(o.refund.at)! }
      : null,
    whatsappOptIn: Boolean(o.whatsappOptIn),
    ownerNotificationStatus: o.ownerNotificationStatus ?? "pending",
    createdAt: iso(o.createdAt) ?? "",
    updatedAt: iso(o.updatedAt) ?? "",
    deliveredAt: iso(o.deliveredAt),
  };
}

export function toAdminOrderDTO(o: AnyDoc): AdminOrderDTO {
  const base = toOrderDTO(o);
  return {
    ...base,
    statusHistory: (o.statusHistory ?? []).map((h: AnyDoc) => ({
      status: h.status,
      at: iso(h.at) ?? "",
      by: h.by ? { type: h.by.type, name: h.by.name } : null,
      note: h.note ?? null,
    })),
    internalNotes: (o.internalNotes ?? []).map((n: AnyDoc) => ({
      id: id(n._id),
      note: n.note,
      adminName: n.adminName ?? "",
      at: iso(n.at) ?? "",
    })),
  };
}
