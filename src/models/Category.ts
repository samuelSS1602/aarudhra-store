import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { ImageSchema } from "./shared";

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 96 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    image: { type: ImageSchema, default: null },
    icon: { type: String, maxlength: 40, default: "" },
    displayOrder: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
CategorySchema.index({ status: 1, displayOrder: 1 });

export type CategoryDoc = InferSchemaType<typeof CategorySchema> & { _id: Types.ObjectId };
export const Category: Model<CategoryDoc> =
  (models.Category as Model<CategoryDoc>) || model<CategoryDoc>("Category", CategorySchema);
