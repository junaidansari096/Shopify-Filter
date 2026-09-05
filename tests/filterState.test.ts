import { describe, it, expect } from "vitest";
import {
  toggleFilter,
  setPrice,
  setSort,
  clearAllFilters,
  readActiveFilters,
  parseFilterState,
} from "../app/utils/filterState";

const BASE = "https://store.myshopify.com/collections/all";

describe("toggleFilter (URL state)", () => {
  it("adds one filter", () => {
    const url = new URL(BASE);
    const next = toggleFilter(url, "filter.p.vendor", "Amul", true);
    expect(next.searchParams.getAll("filter.p.vendor")).toEqual(["Amul"]);
  });

  it("removes one filter", () => {
    const url = new URL(`${BASE}?filter.p.vendor=Amul`);
    const next = toggleFilter(url, "filter.p.vendor", "Amul", false);
    expect(next.searchParams.getAll("filter.p.vendor")).toEqual([]);
    expect(next.searchParams.has("filter.p.vendor")).toBe(false);
  });

  it("adds multiple values to the same filter", () => {
    const url = new URL(`${BASE}?filter.p.vendor=Amul`);
    const step1 = toggleFilter(url, "filter.p.vendor", "Mother Dairy", true);
    const values = step1.searchParams.getAll("filter.p.vendor");
    expect(values).toEqual(["Amul", "Mother Dairy"]);
    // URL-encoded serialization keeps them as separate params
    expect(step1.searchParams.toString()).toContain("filter.p.vendor=Amul");
    expect(step1.searchParams.toString()).toContain(
      "filter.p.vendor=Mother+Dairy",
    );
  });

  it("does not duplicate an existing value", () => {
    const url = new URL(`${BASE}?filter.p.vendor=Amul`);
    const next = toggleFilter(url, "filter.p.vendor", "Amul", true);
    expect(next.searchParams.getAll("filter.p.vendor")).toEqual(["Amul"]);
  });

  it("preserves another filter", () => {
    const url = new URL(`${BASE}?filter.p.vendor=Amul&filter.p.product_type=Milk`);
    const next = toggleFilter(url, "filter.p.product_type", "Milk", false);
    expect(next.searchParams.get("filter.p.vendor")).toBe("Amul");
    expect(next.searchParams.has("filter.p.product_type")).toBe(false);
  });

  it("resets page when a filter changes", () => {
    const url = new URL(`${BASE}?filter.p.vendor=Amul&page=3`);
    const next = toggleFilter(url, "filter.p.vendor", "Amul", false);
    expect(next.searchParams.has("page")).toBe(false);
  });

  it("preserves sorting when toggling a filter", () => {
    const url = new URL(`${BASE}?sort_by=price-ascending&filter.p.vendor=Amul`);
    const next = toggleFilter(url, "filter.p.vendor", "Mother+Dairy", true);
    expect(next.searchParams.get("sort_by")).toBe("price-ascending");
  });

  it("URL encodes special characters", () => {
    const url = new URL(BASE);
    const next = toggleFilter(url, "filter.p.vendor", "Cavin's & Co", true);
    // Decoded value round-trips correctly.
    expect(next.searchParams.getAll("filter.p.vendor")).toEqual(["Cavin's & Co"]);
    // The raw query string must not contain an unescaped ampersand delimiter
    // inside the value; URLSearchParams handles escaping so `&` becomes %26.
    expect(next.searchParams.get("filter.p.vendor")).toBe("Cavin's & Co");
    expect(next.searchParams.toString()).not.toContain("filter.p.vendor=Cavin's & Co");
  });

  it("keeps unrelated parameters like q and collection", () => {
    const url = new URL(`${BASE}?q=sugar&filter.p.vendor=Amul`);
    const next = toggleFilter(url, "filter.p.vendor", "Britannia", true);
    expect(next.searchParams.get("q")).toBe("sugar");
  });
});

describe("clearAllFilters", () => {
  it("removes all filter params but preserves sort and q", () => {
    const url = new URL(
      `${BASE}?filter.p.vendor=Amul&filter.p.product_type=Milk&sort_by=best-selling&q=choco&page=2`,
    );
    const next = clearAllFilters(url);
    // All filter.* removed
    for (const key of [...next.searchParams.keys()]) {
      expect(key.startsWith("filter.")).toBe(false);
    }
    // Unrelated preserved
    expect(next.searchParams.get("sort_by")).toBe("best-selling");
    expect(next.searchParams.get("q")).toBe("choco");
    // Pagination reset
    expect(next.searchParams.has("page")).toBe(false);
  });
});

describe("setPrice", () => {
  const minParam = "filter.v.price.gte";
  const maxParam = "filter.v.price.lte";

  it("sets both bounds", () => {
    const next = setPrice(new URL(BASE), minParam, "100", maxParam, "500");
    expect(next.searchParams.get(minParam)).toBe("100");
    expect(next.searchParams.get(maxParam)).toBe("500");
  });

  it("removes a bound when empty", () => {
    const url = new URL(`${BASE}?${minParam}=100&${maxParam}=500`);
    const next = setPrice(url, minParam, "", maxParam, "500");
    expect(next.searchParams.has(minParam)).toBe(false);
    expect(next.searchParams.get(maxParam)).toBe("500");
  });

  it("resets page", () => {
    const url = new URL(`${BASE}?page=4`);
    const next = setPrice(url, minParam, "10", maxParam, "99");
    expect(next.searchParams.has("page")).toBe(false);
  });
});

describe("setSort", () => {
  it("sets a sort value", () => {
    const next = setSort(new URL(BASE), "price-ascending");
    expect(next.searchParams.get("sort_by")).toBe("price-ascending");
  });

  it("removes sort when empty", () => {
    const url = new URL(`${BASE}?sort_by=best-selling`);
    const next = setSort(url, "");
    expect(next.searchParams.has("sort_by")).toBe(false);
  });
});

describe("readActiveFilters & parseFilterState", () => {
  it("reads active filter params", () => {
    const url = new URL(`${BASE}?filter.p.vendor=Amul&filter.p.vendor=Mother+Dairy`);
    const active = readActiveFilters(url);
    expect(active).toEqual([
      { parameter: "filter.p.vendor", value: "Amul" },
      { parameter: "filter.p.vendor", value: "Mother Dairy" },
    ]);
  });

  it("groups repeated params into an array map", () => {
    const url = new URL(
      `${BASE}?filter.p.vendor=Amul&filter.p.vendor=Britannia&filter.v.availability=1&sort_by=created-descending&filter.v.price.gte=50&filter.v.price.lte=400`,
    );
    const state = parseFilterState(url);
    expect(state.values.get("filter.p.vendor")).toEqual(["Amul", "Britannia"]);
    expect(state.values.get("filter.v.availability")).toEqual(["1"]);
    expect(state.sortBy).toBe("created-descending");
    expect(state.priceMin).toBe("50");
    expect(state.priceMax).toBe("400");
  });
});
