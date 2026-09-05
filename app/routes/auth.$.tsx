import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

/**
 * Catch-all route under /auth*. Shopify's OAuth + token-exchange flows
 * redirect here during install. `authenticate.admin` transparently handles
 * the OAuth begin/callback/token steps and redirects to /app when done.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
