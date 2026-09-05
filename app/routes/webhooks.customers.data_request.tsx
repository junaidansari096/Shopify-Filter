import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * CUSTOMERS_DATA_REQUEST webhook.
 * Fresheek Filters does not collect, store, or process customer personal data.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[Fresheek Filters] Received ${topic} webhook for ${shop}`);
  return new Response(JSON.stringify({ message: "No customer personal data retained." }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
