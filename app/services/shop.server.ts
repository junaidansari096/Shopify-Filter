import { prisma } from "../db.server";
import { graphqlRequest } from "./graphql.server";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

interface GetShopData {
  shop: {
    id: string;
    name: string;
    myshopifyDomain: string;
    currencyCode: string;
    timezoneAbbreviation: string | null;
    primaryDomain?: { url: string; host: string };
  };
}

/**
 * Ensures a Shop row exists for the given shop domain, creating it with
 * currency/timezone data gathered from the Admin API on first install.
 * Returns the persisted Shop.
 */
export async function ensureShop(
  admin: AdminApiContext["graphql"],
  shopDomain: string,
) {
  let currency: string | null = null;
  let timezone: string | null = null;

  try {
    const data = await graphqlRequest<GetShopData>(admin, "getShop.graphql", {});
    currency = data.shop.currencyCode ?? null;
    timezone = data.shop.timezoneAbbreviation ?? null;
  } catch (error) {
    // Non-fatal: proceed with best-effort data.
  }

  return prisma.shop.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      currency,
      timezone,
    },
    update: {
      ...(currency ? { currency } : {}),
      ...(timezone ? { timezone } : {}),
    },
  });
}

/**
 * Retrieves the persisted Shop for a domain without creating it.
 */
export async function getShop(shopDomain: string) {
  return prisma.shop.findUnique({ where: { shopDomain } });
}
