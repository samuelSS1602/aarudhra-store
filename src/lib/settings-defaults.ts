/**
 * Store settings shape + defaults. Persisted in MongoDB (`settings` collection)
 * and editable from /admin/settings. Contact numbers, emails and social links are
 * intentionally blank — the owner configures them; nothing is invented.
 */

export type DeliveryOption = {
  id: string;
  label: string;
  description: string;
  charge: number; // paise
  etaText: string;
  enabled: boolean;
};

export type HomepageBanner = {
  title: string;
  subtitle: string;
  href: string;
  imageUrl: string;
  tone: "green" | "gold" | "charcoal" | "lime";
};

export type StoreHighlight = { icon: string; title: string; text: string };

export type StoreSettings = {
  general: {
    storeName: string;
    tagline: string;
    logoUrl: string;
    description: string;
    address: {
      line1: string;
      line2: string;
      city: string;
      district: string;
      state: string;
      pincode: string;
      country: string;
    };
    supportPhone: string;
    whatsappNumber: string;
    storeHours: string;
    contactEmail: string;
    social: { facebook: string; instagram: string; youtube: string };
    mapQuery: string;
  };
  commerce: {
    currency: "INR";
    taxMode: "inclusive" | "exclusive";
    defaultGstRate: number;
    deliveryOptions: DeliveryOption[];
    freeDeliveryThreshold: number; // paise; 0 = disabled
    minimumOrderValue: number; // paise
    codEnabled: boolean;
    codMaxOrderValue: number; // paise; 0 = no limit
    lowStockThreshold: number;
    returnPolicy: string;
    cancellationPolicy: string;
    deliveryPolicy: string;
    customerCancellableStatuses: string[];
  };
  notifications: {
    ownerWhatsappNumbers: string[];
    ownerNewOrder: boolean;
    customerOrderConfirmation: boolean;
    customerStatusUpdates: boolean;
    statusUpdateEvents: string[];
    ownerTemplateName: string;
    customerTemplateName: string;
    statusTemplateName: string;
    templateLanguage: string;
    ownerMessageMode: "template" | "text";
    maxAttempts: number;
    retryBaseMinutes: number;
  };
  homepage: {
    announcement: { enabled: boolean; text: string; href: string };
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      ctaLabel: string;
      ctaHref: string;
      secondaryCtaLabel: string;
      secondaryCtaHref: string;
      imageUrl: string;
    };
    banners: HomepageBanner[];
    featuredCategoryIds: string[];
    featuredProductIds: string[];
    highlights: StoreHighlight[];
    newsletterEnabled: boolean;
  };
};

export const DEFAULT_SETTINGS: StoreSettings = {
  general: {
    storeName: "Aarudhra Smart Store",
    tagline: "Stationery & home goods for every day",
    logoUrl: "",
    description:
      "Aarudhra Smart Store offers a diverse collection of stationery and home goods at affordable prices, providing customers with a convenient shopping experience and a wide selection of everyday products.",
    address: {
      line1: "New Ammumall Complex, 65/48, New Dharapuram Road",
      line2: "Opposite Town Police Station, Indra Nagar",
      city: "Palani",
      district: "Dindigul",
      state: "Tamil Nadu",
      pincode: "624601",
      country: "India",
    },
    supportPhone: "",
    whatsappNumber: "",
    storeHours: "",
    contactEmail: "",
    social: { facebook: "", instagram: "", youtube: "" },
    mapQuery:
      "Aarudhra Smart Store, New Ammumall Complex, New Dharapuram Road, Indra Nagar, Palani, Tamil Nadu 624601",
  },
  commerce: {
    currency: "INR",
    taxMode: "inclusive",
    defaultGstRate: 18,
    deliveryOptions: [
      {
        id: "standard",
        label: "Standard delivery",
        description: "Delivered to your doorstep in and around Palani",
        charge: 4000,
        etaText: "2–4 business days",
        enabled: true,
      },
      {
        id: "pickup",
        label: "Store pickup",
        description: "Collect from our Palani store",
        charge: 0,
        etaText: "Ready within 1 business day",
        enabled: true,
      },
    ],
    freeDeliveryThreshold: 49900,
    minimumOrderValue: 0,
    codEnabled: true,
    codMaxOrderValue: 0,
    lowStockThreshold: 5,
    returnPolicy:
      "Unused items in original packaging can be returned within 7 days of delivery. Please contact us on WhatsApp with your order number to start a return.",
    cancellationPolicy:
      "Orders can be cancelled free of charge until they are packed. Once shipped, please contact the store.",
    deliveryPolicy:
      "We currently deliver in Palani and nearby areas. Delivery charges and timelines are shown at checkout.",
    customerCancellableStatuses: ["pending", "confirmed"],
  },
  notifications: {
    ownerWhatsappNumbers: [],
    ownerNewOrder: true,
    customerOrderConfirmation: true,
    customerStatusUpdates: true,
    statusUpdateEvents: ["confirmed", "shipped", "out_for_delivery", "delivered", "cancelled"],
    ownerTemplateName: "",
    customerTemplateName: "",
    statusTemplateName: "",
    templateLanguage: "",
    ownerMessageMode: "template",
    maxAttempts: 5,
    retryBaseMinutes: 2,
  },
  homepage: {
    announcement: {
      enabled: true,
      text: "Now taking orders online — Cash on Delivery available in Palani",
      href: "/products",
    },
    hero: {
      eyebrow: "Palani's everyday store",
      title: "Smart essentials for study, work & home.",
      subtitle:
        "Stationery, home goods and daily-use products at honest prices — order online and get it delivered, or pick up at our Palani store.",
      ctaLabel: "Shop all products",
      ctaHref: "/products",
      secondaryCtaLabel: "Browse categories",
      secondaryCtaHref: "/categories",
      imageUrl: "",
    },
    banners: [
      {
        title: "Back-to-school ready",
        subtitle: "Notebooks, pens, geometry boxes & more",
        href: "/categories/school-stationery",
        imageUrl: "",
        tone: "green",
      },
      {
        title: "Organise your home",
        subtitle: "Storage, kitchen & cleaning essentials",
        href: "/categories/storage-and-organization",
        imageUrl: "",
        tone: "gold",
      },
    ],
    featuredCategoryIds: [],
    featuredProductIds: [],
    highlights: [
      { icon: "BadgeIndianRupee", title: "Affordable prices", text: "Everyday products priced fairly for every family." },
      { icon: "Truck", title: "Local delivery", text: "Quick delivery across Palani and nearby areas." },
      { icon: "HandCoins", title: "Cash on Delivery", text: "Pay when your order arrives — no card needed." },
      { icon: "Store", title: "Visit our store", text: "Opposite Town Police Station, New Dharapuram Road." },
    ],
    newsletterEnabled: false,
  },
};
