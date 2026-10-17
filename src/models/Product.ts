import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { ImageSchema } from "./shared";

/** All prices are integer paise. */
const VariantSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 }, // e.g. "Blue / A4"
  sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  options: {
    type: [new Schema({ name: { type: String, maxlength: 40 }, value: { type: String, maxlength: 60 } }, { _id: false })],
    default: [],
  },
  price: { type: Number, min: 0 }, // overrides product price when set
  originalPrice: { type: Number, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  barcode: { type: String, trim: true, maxlength: 64 },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
});

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 64 },
    description: { type: String, maxlength: 5000, default: "" },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    brand: { type: String, trim: true, maxlength: 80, default: "" },
    images: { type: [ImageSchema], default: [] },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0, select: false }, // never sent to customers
    tax: {
      gstRate: { type: Number, enum: [0, 5, 12, 18, 28], default: 18 },
      inclusive: { type: Boolean, default: true },
      hsnCode: { type: String, trim: true, maxlength: 12, default: "" },
    },
    variants: { type: [VariantSchema], default: [] },
    // For products with variants, `stock` is kept equal to the sum of variant stock.
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    barcode: { type: String, trim: true, maxlength: 64 },
    weightGrams: { type: Number, min: 0 },
    dimensions: {
      lengthCm: { type: Number, min: 0 },
      widthCm: { type: Number, min: 0 },
      heightCm: { type: Number, min: 0 },
    },
    specifications: {
      type: [new Schema({ label: { type: String, maxlength: 60 }, value: { type: String, maxlength: 200 } }, { _id: false })],
      default: [],
    },
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "draft", "archived"], default: "active" },
    seo: {
      title: { type: String, maxlength: 70, default: "" },
      description: { type: String, maxlength: 170, default: "" },
    },
    // Derived fields maintained by the service layer (real data, never fabricated).
    discountPercent: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ProductSchema.pre("validate", function (next) {
  if (this.variants && this.variants.length > 0) {
    this.stock = this.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  }
  const o = this.originalPrice ?? 0;
  this.discountPercent = o > this.price ? Math.round(((o - this.price) / o) * 100) : 0;
  next();
});

ProductSchema.index({ status: 1, categoryId: 1, createdAt: -1 });
ProductSchema.index({ status: 1, featured: 1 });
ProductSchema.index({ status: 1, price: 1 });
ProductSchema.index({ status: 1, salesCount: -1 });
ProductSchema.index({ status: 1, discountPercent: -1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ "variants.sku": 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index(
  { name: "text", brand: "text", tags: "text", description: "text" },
  { weights: { name: 10, brand: 5, tags: 4, description: 1 }, name: "product_text" },
);

export type ProductDoc = InferSchemaType<typeof ProductSchema> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type VariantDoc = InferSchemaType<typeof VariantSchema> & { _id: Types.ObjectId };
export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) || model<ProductDoc>("Product", ProductSchema);
