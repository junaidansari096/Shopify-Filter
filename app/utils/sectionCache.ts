export interface CacheEntry {
  url: string;
  html: string;
}

/**
 * A bounded, first-in-first-out in-memory cache for fetched section HTML.
 * Never stores failed responses (caller must only cache successes).
 */
export class SectionCache {
  private entries = new Map<string, string>();
  private readonly maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  get(url: string): string | null {
    return this.entries.get(url) ?? null;
  }

  set(url: string, html: string): void {
    if (this.entries.has(url)) {
      this.entries.delete(url);
    }
    if (this.entries.size >= this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(url, html);
  }

  has(url: string): boolean {
    return this.entries.has(url);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * Parses the JSON body Shopify returns for a section request
 * (?sections=section-id). Throws on malformed input.
 */
export function parseSectionsResponse(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Section response is not a JSON object");
    }
    return parsed as Record<string, string>;
  } catch (error) {
    throw new Error(`Malformed section response: ${(error as Error).message}`);
  }
}

/**
 * Validates a price range from two raw input strings.
 * Returns { min, max } with empty strings for blank inputs, or null when the
 * inputs are invalid (negative, non-numeric, or min > max).
 */
export function validatePrice(
  minRaw: string,
  maxRaw: string,
): { min: string; max: string } | null {
  const minVal = minRaw.trim();
  const maxVal = maxRaw.trim();

  const minNum = minVal === "" ? null : Number(minVal);
  const maxNum = maxVal === "" ? null : Number(maxVal);

  if (minNum !== null && (Number.isNaN(minNum) || minNum < 0)) {
    return null;
  }
  if (maxNum !== null && (Number.isNaN(maxNum) || maxNum < 0)) {
    return null;
  }
  if (minNum !== null && maxNum !== null && minNum > maxNum) {
    return null;
  }

  return {
    min: minNum === null ? "" : String(minNum),
    max: maxNum === null ? "" : String(maxNum),
  };
}
