import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

/**
 * APP_UNINSTALLED webhook. Cleans up app-specific data for the shop.
 * Theme App Extensions stop rendering automatically on uninstall, so no
 * injected theme code needs removal. Cascade deletes shop configuration.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Fresheek Filters received ${topic} webhook for ${shop}`);

  if (session) {
    // Delete the shop's session rows held by PrismaSessionStorage.
    await prisma.session.deleteMany({ where: { shop } });
  }

  // Delete the Shop row (cascades to filters/configuration).
  await prisma.shop.deleteMany({ where: { shopDomain: shop || "" } });

  return new Response();
};
