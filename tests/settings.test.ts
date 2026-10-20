import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";
import { withDefaults } from "@/services/settings.service";

describe("store settings defaults", () => {
  it("fills in settings added after the stored (or cached) copy was saved", () => {
    // Shape of a homepage saved before the brands strip existed.
    const { brands: _added, ...olderHomepage } = DEFAULT_SETTINGS.homepage;
    const merged = withDefaults({ homepage: { ...olderHomepage, newsletterEnabled: true } });
    expect(merged.homepage.brands).toEqual(DEFAULT_SETTINGS.homepage.brands);
    expect(merged.homepage.newsletterEnabled).toBe(true); // saved values still win
  });

  it("never shares the defaults object between calls", () => {
    const a = withDefaults(undefined);
    a.homepage.brands.items.push({ name: "Mutated", logoUrl: "" });
    expect(withDefaults(undefined).homepage.brands.items).not.toContainEqual({ name: "Mutated", logoUrl: "" });
  });
});
