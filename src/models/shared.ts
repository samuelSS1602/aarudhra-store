import { Schema } from "mongoose";

export const ImageSchema = new Schema(
  {
    url: { type: String, required: true, maxlength: 1000 },
    publicId: { type: String, maxlength: 300 },
    alt: { type: String, maxlength: 200, default: "" },
    width: Number,
    height: Number,
  },
  { _id: false },
);

export const ActorSchema = new Schema(
  {
    type: { type: String, enum: ["system", "customer", "admin"], required: true },
    id: { type: Schema.Types.ObjectId },
    name: { type: String, maxlength: 120 },
  },
  { _id: false },
);
