import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

/**
 * SHOP_REDACT webhook.
 * Triggered 48 hours after app uninstallation to purge all residual store data.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[Fresheek Filters] Received ${topic} webhook for ${shop}`);

  if (shop) {
    await prisma.session.deleteMany({ where: { shop } });
    await prisma.shop.deleteMany({ where: { shopDomain: shop } });
  }

  return new Response(null, { status: 200 });
};
