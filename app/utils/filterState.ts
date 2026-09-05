export interface FilterStateParam {
  parameter: string;
  value: string;
}

export interface FilterState {
  values: Map<string, string[]>;
  sortBy?: string;
  priceMin?: string;
  priceMax?: string;
}

/**
 * Toggle a multi-value filter parameter, preserving all other parameters,
 * and resetting pagination when a filter changes. The URL is the primary,
 * shareable source of filter state.
 *
 * Example: toggling "Amul" on under filter.p.vendor produces
 * `?filter.p.vendor=Amul` and toggling a second vendor appends it.
 */
export function toggleFilter(
  url: URL,
  parameter: string,
  value: string,
  checked: boolean,
): URL {
  const next = new URL(url.toString());

  const values = next.searchParams.getAll(parameter);
  next.searchParams.delete(parameter);

  const updated = checked
    ? [...new Set([...values, value])]
    : values.filter((entry) => entry !== value);

  for (const item of updated) {
    next.searchParams.append(parameter, item);
  }

  // Reset pagination when filters change.
  next.searchParams.delete("page");

  return next;
}

/**
 * Sets a price range, removing empty bounds and resetting pagination.
 */
export function setPrice(
  url: URL,
  minParam: string,
  minVal: string,
  maxParam: string,
  maxVal: string,
): URL {
  const next = new URL(url.toString());
  next.searchParams.delete(minParam);
  next.searchParams.delete(maxParam);
  if (minVal) {
    next.searchParams.set(minParam, minVal);
  }
  if (maxVal) {
    next.searchParams.set(maxParam, maxVal);
  }
  next.searchParams.delete("page");
  return next;
}

/**
 * Sets the sort_by parameter without disturbing filters.
 */
export function setSort(url: URL, sortBy: string): URL {
  const next = new URL(url.toString());
  if (sortBy) {
    next.searchParams.set("sort_by", sortBy);
  } else {
    next.searchParams.delete("sort_by");
  }
  return next;
}

/**
 * Removes every filter.* parameter while preserving unrelated params
 * (collection path, sort, q, etc.).
 */
export function clearAllFilters(url: URL): URL {
  const next = new URL(url.toString());
  const keysToRemove: string[] = [];
  next.searchParams.forEach((_value, key) => {
    if (key.startsWith("filter.")) {
      keysToRemove.push(key);
    }
  });
  for (const key of keysToRemove) {
    next.searchParams.delete(key);
  }
  next.searchParams.delete("page");
  return next;
}

/**
 * Reads the currently active filter parameters from a URL.
 */
export function readActiveFilters(url: URL): FilterStateParam[] {
  const active: FilterStateParam[] = [];
  url.searchParams.forEach((value, key) => {
    if (key.startsWith("filter.")) {
      active.push({ parameter: key, value });
    }
  });
  return active;
}

/**
 * Parses a URL into a structured FilterState (param -> values map).
 */
export function parseFilterState(url: URL): FilterState {
  const values = new Map<string, string[]>();
  let priceMin: string | undefined;
  let priceMax: string | undefined;
  let sortBy: string | undefined;

  url.searchParams.forEach((value, key) => {
    if (key === "sort_by") {
      sortBy = value;
      return;
    }
    if (key === "filter.v.price.gte") {
      priceMin = value;
      return;
    }
    if (key === "filter.v.price.lte") {
      priceMax = value;
      return;
    }
    if (key.startsWith("filter.")) {
      const existing = values.get(key) ?? [];
      existing.push(value);
      values.set(key, existing);
    }
  });

  return { values, sortBy, priceMin, priceMax };
}
