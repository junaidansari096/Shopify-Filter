import { graphqlRequest } from "./graphql.server";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

interface ProductNode {
  id: string;
  vendor: string;
  productType: string;
  options: Array<{ name: string; values: string[] }>;
  metafields?: {
    edges: Array<{ node: { key: string; namespace: string; value: string; type: string } }>;
  };
}

interface GetFilterDefinitionsData {
  shop: { id: string; productTypes?: { edges: Array<{ node: string }> } };
  products: { edges: Array<{ node: ProductNode }> };
  metafieldDefinitions: {
    edges: Array<{
      node: { id: string; key: string; namespace: string; name: string; type?: { name: string; category: string } };
    }>;
  };
}

export interface AvailableFilterInfo {
  sourceType: "vendor" | "product_type" | "price" | "availability" | "category" | "option" | "metafield";
  sourceKey: string;
  label: string;
  description: string;
  optionCount: number;
  sampleOptions: string[];
}

/**
 * Discovers available filter sources from the Admin API so the merchant
 * can configure filters against real data rather than guessing parameter names.
 */
export async function detectAvailableFilters(admin: AdminApiContext["graphql"]): Promise<AvailableFilterInfo[]> {
  const data = await graphqlRequest<GetFilterDefinitionsData>(
    admin,
    "getFilterDefinitions.graphql",
    { first: 50, productFirst: 25 },
  );

  const results: AvailableFilterInfo[] = [];

  // Vendor
  const vendors = new Set<string>();
  // Product types
  const productTypes = new Set<string>();
  // Options (Size, Color, ...)
  const optionMap = new Map<string, Set<string>>();

  for (const edge of data.products?.edges ?? []) {
    const node = edge.node;
    if (node.vendor) vendors.add(node.vendor);
    if (node.productType) productTypes.add(node.productType);
    for (const option of node.options ?? []) {
      if (!optionMap.has(option.name)) optionMap.set(option.name, new Set());
      for (const value of option.values ?? []) {
        optionMap.get(option.name)?.add(value);
      }
    }
  }

  if (vendors.size > 0) {
    results.push({
      sourceType: "vendor",
      sourceKey: "filter.p.vendor",
      label: "Brand (Vendor)",
      description: "Filter by product vendor. Shown to shoppers as Brand.",
      optionCount: vendors.size,
      sampleOptions: [...vendors].slice(0, 8),
    });
  }

  const shopProductTypes = data.shop?.productTypes?.edges?.map((e) => e.node) ?? [];
  const allProductTypes = new Set([...shopProductTypes, ...productTypes]);
  if (allProductTypes.size > 0) {
    results.push({
      sourceType: "product_type",
      sourceKey: "filter.p.product_type",
      label: "Product type",
      description: "Filter by Shopify product type field.",
      optionCount: allProductTypes.size,
      sampleOptions: [...allProductTypes].slice(0, 8),
    });
  }

  for (const [name, values] of optionMap) {
    results.push({
      sourceType: "option",
      sourceKey: `filter.v.option.${slugify(name)}`,
      label: name,
      description: `Filter by the "${name}" variant option.`,
      optionCount: values.size,
      sampleOptions: [...values].slice(0, 8),
    });
  }

  for (const edge of data.metafieldDefinitions?.edges ?? []) {
    const def = edge.node;
    results.push({
      sourceType: "metafield",
      sourceKey: `filter.p.m.${def.namespace}.${def.key}`,
      label: def.name || `${def.namespace}.${def.key}`,
      description: `Metafield filter (${def.namespace}.${def.key})`,
      optionCount: 0,
      sampleOptions: [],
    });
  }

  return results;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
