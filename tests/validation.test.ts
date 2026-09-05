import { describe, expect, it } from "vitest";
import {
  filterConfigSchema,
  appearanceSchema,
  mobileSettingsSchema,
  appSettingsSchema,
  filterConfigsBulkSchema,
} from "../app/services/filters.server";

describe("filterConfigSchema validation", () => {
  it("accepts a valid config", () => {
    const result = filterConfigSchema.safeParse({
      sourceKey: "filter.p.vendor",
      label: "Brand",
      enabled: true,
      presentation: "checkbox-list",
      searchable: true,
      showCounts: true,
      initialVisibleCount: 8,
      showMore: true,
      expandedDesktop: true,
      expandedMobile: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty sourceKey", () => {
    const result = filterConfigSchema.safeParse({ sourceKey: "", label: "Brand" });
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = filterConfigSchema.safeParse({ sourceKey: "filter.p.vendor", label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid presentation value", () => {
    const result = filterConfigSchema.safeParse({
      sourceKey: "filter.p.vendor",
      label: "Brand",
      presentation: "invalid-type" as any,
    });
    expect(result.success).toBe(false);
  });

  it("rejects initialVisibleCount out of range", () => {
    const result = filterConfigSchema.safeParse({
      sourceKey: "filter.p.vendor",
      label: "Brand",
      initialVisibleCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("applies defaults when omitted", () => {
    const result = filterConfigSchema.safeParse({ sourceKey: "filter.p.vendor", label: "Brand" });
    if (!result.success) {
      throw new Error("expected success");
    }
    expect(result.data.presentation).toBe("checkbox-list");
    expect(result.data.enabled).toBe(true);
    expect(result.data.initialVisibleCount).toBe(8);
  });

  it("rejects duplicate sourceKey entries in bulk filters", () => {
    const result = filterConfigsBulkSchema.safeParse({
      filters: [
        { sourceKey: "filter.p.vendor", label: "Brand 1" },
        { sourceKey: "filter.p.vendor", label: "Brand 2" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Filter source keys must be unique");
    }
  });
});

describe("appearanceSchema validation", () => {
  it("accepts valid appearance input with custom values", () => {
    const result = appearanceSchema.safeParse({
      sidebarWidth: 280,
      accentColor: "#FE6B00",
      textColor: "#111827",
      mobileBreakpoint: 1024,
      stickyTopOffset: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sidebarWidth).toBe(280);
      expect(result.data.accentColor).toBe("#FE6B00");
      expect(result.data.mobileBreakpoint).toBe(1024);
      expect(result.data.headingSize).toBe("16px"); // default
    }
  });

  it("rejects invalid hex color format", () => {
    const result = appearanceSchema.safeParse({
      accentColor: "red",
    });
    expect(result.success).toBe(false);
  });

  it("rejects sidebarWidth outside allowed range (180-450)", () => {
    const tooNarrow = appearanceSchema.safeParse({ sidebarWidth: 150 });
    const tooWide = appearanceSchema.safeParse({ sidebarWidth: 500 });
    expect(tooNarrow.success).toBe(false);
    expect(tooWide.success).toBe(false);
  });

  it("rejects stickyTopOffset outside allowed range (0-400)", () => {
    const negative = appearanceSchema.safeParse({ stickyTopOffset: -10 });
    const tooHigh = appearanceSchema.safeParse({ stickyTopOffset: 500 });
    expect(negative.success).toBe(false);
    expect(tooHigh.success).toBe(false);
  });
});

describe("mobileSettingsSchema validation", () => {
  it("accepts valid mobile configuration", () => {
    const result = mobileSettingsSchema.safeParse({
      mobileBreakpoint: 768,
      stickyTopOffset: 60,
      mobileDrawerPosition: "left",
      mobileTriggerText: "Filter & Refine",
      mobileButtonVariant: "solid",
      mobileShowProductCount: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects mobileBreakpoint below 600 or above 1600", () => {
    expect(mobileSettingsSchema.safeParse({ mobileBreakpoint: 400 }).success).toBe(false);
    expect(mobileSettingsSchema.safeParse({ mobileBreakpoint: 2000 }).success).toBe(false);
  });
});

describe("appSettingsSchema validation", () => {
  it("applies default settings when empty", () => {
    const result = appSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.showProductCount).toBe(true);
      expect(result.data.showActiveFilters).toBe(true);
      expect(result.data.productGridSelector).toBe("");
      expect(result.data.paginationMode).toBe("infinite");
    }
  });

  it("accepts custom selectors and toggles", () => {
    const result = appSettingsSchema.safeParse({
      showProductCount: false,
      showActiveFilters: false,
      productGridSelector: "#main-collection-product-grid",
      resultsSectionSelector: "[data-section-id='collection-grid']",
      paginationMode: "pagination",
      mobileDrawerPosition: "right",
      mobileTriggerText: "Filter Products",
      mobileButtonVariant: "outline",
      mobileShowProductCount: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.showProductCount).toBe(false);
      expect(result.data.productGridSelector).toBe("#main-collection-product-grid");
      expect(result.data.paginationMode).toBe("pagination");
      expect(result.data.mobileDrawerPosition).toBe("right");
    }
  });
});

describe("api/config endpoint loader", () => {
  it("rejects request without shop parameter with 400 status", async () => {
    const { loader } = await import("../app/routes/api.config");
    const req = new Request("https://app.example.com/api/config");
    const res = await loader({ request: req } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing shop parameter");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("handles OPTIONS preflight with CORS headers", async () => {
    const { loader } = await import("../app/routes/api.config");
    const req = new Request("https://app.example.com/api/config?shop=unknown.myshopify.com", {
      method: "OPTIONS",
    });
    const res = await loader({ request: req } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("rejects invalid shop domain format with 400 status", async () => {
    const { loader } = await import("../app/routes/api.config");
    const req = new Request("https://app.example.com/api/config?shop=invalid<script>");
    const res = await loader({ request: req } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid shop domain format");
  });

  it("returns default config when shop is not in database", async () => {
    const { loader } = await import("../app/routes/api.config");
    const req = new Request("https://app.example.com/api/config?shop=nonexistent-shop.myshopify.com");
    const res = await loader({ request: req } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.filters)).toBe(true);
    expect(data.filters.length).toBe(0);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});


