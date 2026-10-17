import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Singleton store settings document (key: "store"). The `data` payload is validated
 * by the Zod schema in `src/lib/validation/settings.ts` before every write and
 * deep-merged with DEFAULT_SETTINGS on read.
 */
const SettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true, minimize: false },
);

export type SettingsDoc = { _id: Types.ObjectId; key: string; data: Record<string, unknown>; updatedAt: Date };
export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) || model<SettingsDoc>("Settings", SettingsSchema);
