import { describe, it, expect } from "vitest";
import { SectionCache, parseSectionsResponse, validatePrice } from "../app/utils/sectionCache";

describe("SectionCache", () => {
  it("stores and retrieves an entry", () => {
    const cache = new SectionCache();
    cache.set("/collections/all?filter.p.vendor=Amul", "<div>grid</div>");
    expect(cache.get("/collections/all?filter.p.vendor=Amul")).toBe("<div>grid</div>");
  });

  it("is bounded by maxSize (evicts oldest)", () => {
    const cache = new SectionCache(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
  });

  it("does not cache anything unless set is called (failed responses never enter)", () => {
    const cache = new SectionCache();
    expect(cache.get("/nope")).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("refreshes recency of an existing key on re-set", () => {
    const cache = new SectionCache(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("a", "1-updated"); // makes a most-recent
    cache.set("c", "3"); // evicts b, not a
    expect(cache.get("a")).toBe("1-updated");
    expect(cache.has("b")).toBe(false);
  });

  it("clears all entries", () => {
    const cache = new SectionCache();
    cache.set("a", "1");
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe("parseSectionsResponse", () => {
  it("parses a valid section JSON body", () => {
    const html = '<div id="grid">products</div>';
    const parsed = parseSectionsResponse(JSON.stringify({ "main-collection": html }));
    expect(parsed["main-collection"]).toBe(html);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSectionsResponse("not json")).toThrow();
  });

  it("rejects a non-object body", () => {
    expect(() => parseSectionsResponse("[1,2,3]")).toThrow();
  });
});

describe("validatePrice", () => {
  it("accepts a valid range", () => {
    expect(validatePrice("100", "500")).toEqual({ min: "100", max: "500" });
  });

  it("returns empty strings for blank inputs", () => {
    expect(validatePrice("", "")).toEqual({ min: "", max: "" });
  });

  it("rejects negative values", () => {
    expect(validatePrice("-5", "500")).toBeNull();
    expect(validatePrice("100", "-1")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(validatePrice("abc", "500")).toBeNull();
    expect(validatePrice("100", "x")).toBeNull();
  });

  it("rejects min greater than max", () => {
    expect(validatePrice("900", "100")).toBeNull();
  });
});
