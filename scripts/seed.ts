/**
 * Seeds the starting categories and DEMO products.
 *
 *   npm run seed                 # starting categories only (safe to re-run)
 *   npm run seed -- --demo       # also add clearly-labelled DEMO products for testing
 *   npm run seed -- --clear-demo # removes demo products that were never ordered
 *
 * Every demo product has `isDemo: true`, brand "Demo" and a description beginning
 * with "DEMO PRODUCT", so it's obvious in the admin and storefront. Replace demo data
 * with real products before launch. Refuses to run in production without --force.
 */
import "./_env";
import { parseArgs } from "node:util";
import { connectDB, disconnectDB } from "../src/lib/mongodb";
import { slugify } from "../src/lib/utils";
import { Category } from "../src/models/Category";
import { Product } from "../src/models/Product";
import { Order } from "../src/models/Order";
import { InventoryLog } from "../src/models/misc";
import { deleteImage, storeImage } from "../src/lib/media-store";
import { productSvg, type ArtKind } from "./demo-art";

const SWATCHES = ["#e74c3c", "#f39c12", "#f1c40f", "#27ae60", "#16a085", "#2980b9", "#8e44ad", "#d35400", "#2c3e50", "#e84393", "#00b894", "#6c5ce7"];

/** Illustration for each DEMO product, in the same order as DEMO below. */
const ART: [ArtKind, string, string[]?][] = [
  ["notebook", "#2b5fd0"],
  ["notebook", "#16a085"],
  ["notebook", "#8e2b4f"],
  ["ream", "#1e63b0"],
  ["pens", "#1e63b0", ["#1e63b0", "#1e63b0", "#1e63b0"]],
  ["pens", "#2c3e50", ["#1e63b0", "#2c3e50", "#1e63b0"]],
  ["pencils", "#f4c430"],
  ["marker", "#2c3e50"],
  ["geometry", "#2b3590"],
  ["eraser", "#2b5fd0", ["#e74c3c", "#2b5fd0", "#27ae60"]],
  ["sharpener", "#8a92a3"],
  ["scale", "#00a8cc"],
  ["crayons", "#e67e22", SWATCHES],
  ["watercolour", "#2980b9", SWATCHES],
  ["glue", "#27ae60"],
  ["paper", "#e84393", ["#e74c3c", "#f39c12", "#f1c40f", "#27ae60", "#16a085", "#2980b9"]],
  ["folder", "#8e44ad"],
  ["stapler", "#c0392b"],
  ["folder", "#00a8cc"],
  ["containers", "#00a8cc", ["#e74c3c", "#f39c12", "#f1c40f"]],
  ["ladle", "#7f8c8d"],
  ["peeler", "#27ae60"],
  ["cloth", "#2980b9", ["#e74c3c", "#f39c12", "#f1c40f"]],
  ["brush", "#8e44ad"],
  ["scrub", "#27ae60"],
  ["storage", "#00a8cc"],
  ["organiser", "#2c3e50", ["#1e63b0", "#c0392b"]],
  ["hooks", "#5b6474"],
  ["hooks", "#1e63b0"],
  ["bottle", "#7f8c8d"],
  ["towel", "#16a085"],
  ["soap", "#00b894"],
  ["matchbox", "#c0392b"],
  ["kit", "#2b5fd0"],
];

/** Renders the demo illustration and stores it like an uploaded photo (MongoDB GridFS, WebP). */
async function demoImage(index: number, name: string) {
  const [kind, color, alt] = ART[index] ?? ["notebook", "#2b5fd0"];
  const svg = productSvg(kind, color, alt ?? SWATCHES);
  const img = await storeImage(new Uint8Array(Buffer.from(svg)), { folder: "products", uploadedBy: "seed" });
  return { url: img.url, publicId: img.publicId, alt: `${name} (illustration)`, width: img.width, height: img.height };
}

const { values } = parseArgs({
  options: {
    demo: { type: "boolean", default: false },
    "categories-only": { type: "boolean", default: false }, // kept for compatibility
    "clear-demo": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
  },
});

const CATEGORIES: { name: string; icon: string; description: string }[] = [
  { name: "School Stationery", icon: "Backpack", description: "Everything for the school bag — notebooks, geometry boxes, erasers and more." },
  { name: "Office Supplies", icon: "Briefcase", description: "Files, staplers, registers and desk essentials." },
  { name: "Notebooks and Paper", icon: "NotebookPen", description: "Ruled and unruled notebooks, long books, chart paper and sheets." },
  { name: "Pens and Writing Instruments", icon: "PenTool", description: "Ball pens, gel pens, pencils and markers." },
  { name: "Art and Craft Supplies", icon: "Palette", description: "Colours, brushes, craft paper and glue." },
  { name: "Home Essentials", icon: "Home", description: "Useful everyday items for every home." },
  { name: "Kitchen Accessories", icon: "ChefHat", description: "Containers, tools and kitchen helpers." },
  { name: "Cleaning Essentials", icon: "SprayCan", description: "Brushes, mops, cloths and cleaning tools." },
  { name: "Storage and Organization", icon: "Boxes", description: "Boxes, organisers and storage solutions." },
  { name: "Household Utilities", icon: "Wrench", description: "Practical utilities for around the house." },
  { name: "Daily-Use Products", icon: "ShoppingBasket", description: "Small daily needs at affordable prices." },
  { name: "Special Offers", icon: "Tag", description: "Limited-time deals and value packs." },
];

type Demo = {
  name: string;
  cat: string;
  price: number; // rupees
  mrp?: number;
  stock: number;
  gst?: number;
  featured?: boolean;
  tags?: string[];
  specs?: [string, string][];
  variants?: { name: string; options: [string, string][]; stock: number; price?: number }[];
};

const DEMO: Demo[] = [
  { name: "Single-Line Ruled Notebook, 172 pages", cat: "Notebooks and Paper", price: 45, mrp: 52, stock: 120, gst: 12, featured: true, tags: ["notebook", "ruled", "school"], specs: [["Pages", "172"], ["Size", "18 × 24 cm"], ["Ruling", "Single line"]] },
  { name: "Unruled Practical Notebook, 100 pages", cat: "Notebooks and Paper", price: 38, stock: 80, gst: 12, tags: ["practical", "unruled"] },
  { name: "Long Size Notebook, 200 pages", cat: "Notebooks and Paper", price: 65, mrp: 72, stock: 60, gst: 12, tags: ["long book"] },
  { name: "A4 Copier Paper Ream, 500 sheets", cat: "Office Supplies", price: 299, mrp: 340, stock: 25, gst: 12, featured: true, tags: ["a4", "printer paper"] },
  { name: "Blue Ball Pen, Pack of 10", cat: "Pens and Writing Instruments", price: 50, mrp: 60, stock: 200, gst: 18, featured: true, tags: ["pen", "ball pen", "blue"] },
  {
    name: "Gel Pen Set",
    cat: "Pens and Writing Instruments",
    price: 60,
    stock: 0,
    gst: 18,
    tags: ["gel pen"],
    variants: [
      { name: "Blue / Pack of 5", options: [["Colour", "Blue"], ["Pack", "5"]], stock: 40 },
      { name: "Black / Pack of 5", options: [["Colour", "Black"], ["Pack", "5"]], stock: 35 },
      { name: "Blue / Pack of 10", options: [["Colour", "Blue"], ["Pack", "10"]], stock: 20, price: 110 },
      { name: "Black / Pack of 10", options: [["Colour", "Black"], ["Pack", "10"]], stock: 3, price: 110 },
    ],
  },
  { name: "HB Pencils, Pack of 10", cat: "Pens and Writing Instruments", price: 40, stock: 150, gst: 12, tags: ["pencil"] },
  { name: "Permanent Marker, Black", cat: "Pens and Writing Instruments", price: 25, stock: 90, gst: 18 },
  { name: "Geometry Box with Compass", cat: "School Stationery", price: 120, mrp: 140, stock: 45, gst: 18, featured: true, tags: ["geometry", "compass", "school"] },
  { name: "Non-Dust Eraser, Pack of 5", cat: "School Stationery", price: 25, stock: 4, gst: 12, tags: ["eraser"] },
  { name: "Metal Sharpener, Pack of 3", cat: "School Stationery", price: 30, stock: 70, gst: 18 },
  { name: "30 cm Plastic Scale", cat: "School Stationery", price: 15, stock: 100, gst: 18 },
  { name: "Wax Crayons, 24 Shades", cat: "Art and Craft Supplies", price: 85, mrp: 95, stock: 30, gst: 12, tags: ["crayons", "colours"] },
  { name: "Watercolour Cake Set, 12 Shades", cat: "Art and Craft Supplies", price: 140, stock: 18, gst: 12 },
  { name: "Glue Stick, 15 g", cat: "Art and Craft Supplies", price: 30, stock: 85, gst: 18 },
  { name: "Coloured Craft Paper, 50 Sheets", cat: "Art and Craft Supplies", price: 90, stock: 22, gst: 12 },
  { name: "Box File, Foolscap Size", cat: "Office Supplies", price: 110, stock: 35, gst: 18 },
  { name: "Mini Stapler with Pins", cat: "Office Supplies", price: 95, mrp: 120, stock: 28, gst: 18, tags: ["stapler"] },
  { name: "Clear Document Folder, Pack of 5", cat: "Office Supplies", price: 75, stock: 2, gst: 18 },
  { name: "Airtight Food Container Set, 3 pcs", cat: "Kitchen Accessories", price: 249, mrp: 299, stock: 20, gst: 18, featured: true, tags: ["container", "kitchen"] },
  { name: "Stainless Steel Kitchen Ladle", cat: "Kitchen Accessories", price: 120, stock: 15, gst: 12 },
  { name: "Vegetable Peeler", cat: "Kitchen Accessories", price: 45, stock: 60, gst: 12 },
  { name: "Microfibre Cleaning Cloth, Pack of 3", cat: "Cleaning Essentials", price: 99, mrp: 129, stock: 50, gst: 12, tags: ["cloth", "cleaning"] },
  { name: "Floor Cleaning Brush with Handle", cat: "Cleaning Essentials", price: 180, stock: 12, gst: 18 },
  { name: "Scrub Pad, Pack of 4", cat: "Cleaning Essentials", price: 40, stock: 0, gst: 18 },
  { name: "Plastic Storage Box with Lid, 10 L", cat: "Storage and Organization", price: 220, stock: 16, gst: 18 },
  { name: "Desk Organiser Pen Stand", cat: "Storage and Organization", price: 150, mrp: 180, stock: 14, gst: 18 },
  { name: "Wall Hooks, Pack of 6", cat: "Household Utilities", price: 60, stock: 40, gst: 18 },
  { name: "Extension Cord Holder Clips", cat: "Household Utilities", price: 35, stock: 55, gst: 18 },
  { name: "Steel Water Bottle, 1 L", cat: "Home Essentials", price: 299, mrp: 349, stock: 24, gst: 18, tags: ["bottle"] },
  { name: "Cotton Hand Towel", cat: "Home Essentials", price: 89, stock: 30, gst: 5 },
  { name: "Dish Wash Bar, Pack of 3", cat: "Daily-Use Products", price: 30, stock: 100, gst: 18 },
  { name: "Matchbox Pack of 10", cat: "Daily-Use Products", price: 10, stock: 200, gst: 12 },
  { name: "Back-to-School Value Kit", cat: "Special Offers", price: 399, mrp: 499, stock: 10, gst: 12, featured: true, tags: ["combo", "school", "offer"], specs: [["Includes", "4 notebooks, 10 pens, geometry box, eraser & sharpener"]] },
];

async function main() {
  if (process.env.NODE_ENV === "production" && !values.force) {
    throw new Error("Refusing to seed demo data with NODE_ENV=production. Pass --force if you really mean it.");
  }
  await connectDB();

  if (values["clear-demo"]) {
    const demo = await Product.find({ isDemo: true }).select("_id name images").lean();
    let removed = 0;
    for (const p of demo) {
      if (await Order.exists({ "items.productId": p._id })) {
        await Product.updateOne({ _id: p._id }, { $set: { status: "archived" } });
      } else {
        await Product.deleteOne({ _id: p._id });
        await InventoryLog.deleteMany({ productId: p._id });
        for (const img of p.images ?? []) if (img.publicId?.startsWith("mongo:")) await deleteImage(img.publicId.slice(6));
        removed++;
      }
    }
    console.log(`✔ Removed ${removed} demo product(s); ${demo.length - removed} were archived because they appear in orders.`);
    return;
  }

  const catIds = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.name);
    const doc = await Category.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name: c.name, slug, icon: c.icon, description: c.description, displayOrder: i + 1, status: "active" } },
      { upsert: true, new: true },
    );
    catIds.set(c.name, String(doc._id));
  }
  console.log(`✔ ${CATEGORIES.length} categories ready`);
  if (values["categories-only"] || !values.demo) {
    console.log("ℹ Demo products not added. Use `npm run seed -- --demo` to add sample products for testing.");
    return;
  }

  let created = 0;
  let illustrated = 0;
  for (const [i, d] of DEMO.entries()) {
    const slug = `demo-${slugify(d.name)}`;
    const existing = await Product.findOne({ slug }).select("images").lean();
    if (existing) {
      if (!existing.images?.length) {
        await Product.updateOne({ _id: existing._id }, { $set: { images: [await demoImage(i, d.name)] } });
        illustrated++;
      }
      continue;
    }
    const sku = `DEMO-${String(i + 1).padStart(3, "0")}`;
    const p = await Product.create({
      name: d.name,
      slug,
      sku,
      description: `DEMO PRODUCT — sample listing for testing the store. Replace with real products before launch.\n\n${d.name} for everyday use.`,
      categoryId: catIds.get(d.cat),
      brand: "Demo",
      images: [await demoImage(i, d.name)],
      price: d.price * 100,
      originalPrice: d.mrp ? d.mrp * 100 : undefined,
      tax: { gstRate: d.gst ?? 18, inclusive: true },
      stock: d.variants ? 0 : d.stock,
      lowStockThreshold: 5,
      featured: Boolean(d.featured),
      tags: d.tags ?? [],
      specifications: (d.specs ?? []).map(([label, value]) => ({ label, value })),
      variants: (d.variants ?? []).map((v, k) => ({
        name: v.name,
        sku: `${sku}-${k + 1}`,
        options: v.options.map(([name, value]) => ({ name, value })),
        stock: v.stock,
        price: v.price ? v.price * 100 : undefined,
      })),
      status: "active",
      isDemo: true,
    });
    const logs = p.variants.length
      ? p.variants.filter((v) => v.stock > 0).map((v) => ({ productId: p._id, variantId: v._id, sku: v.sku, productName: p.name, adjustmentType: "initial", quantityChange: v.stock, previousStock: 0, newStock: v.stock, reason: "Demo seed" }))
      : p.stock > 0
        ? [{ productId: p._id, sku: p.sku, productName: p.name, adjustmentType: "initial", quantityChange: p.stock, previousStock: 0, newStock: p.stock, reason: "Demo seed" }]
        : [];
    if (logs.length) await InventoryLog.insertMany(logs);
    created++;
  }
  console.log(`✔ ${created} demo product(s) created with images (${DEMO.length - created} already existed${illustrated ? `, ${illustrated} given images` : ""})`);
}

main()
  .catch((err) => {
    console.error(`✖ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
