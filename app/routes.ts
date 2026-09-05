import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";

const routes: RouteConfig = [
  // Landing route: redirect into the embedded app shell.
  index("routes/_index.tsx"),
  // Shopify OAuth + token-exchange flows under /auth/*.
  route("auth/*", "routes/auth.$.tsx"),
  // Health check & keepalive endpoint.
  route("health", "routes/health.ts"),
  // Webhooks.
  route("webhooks/app/uninstalled", "routes/webhooks.app.uninstalled.tsx"),
  route("webhooks/customers/data_request", "routes/webhooks.customers.data_request.tsx"),
  route("webhooks/customers/redact", "routes/webhooks.customers.redact.tsx"),
  route("webhooks/shop/redact", "routes/webhooks.shop.redact.tsx"),
  // Storefront configuration delivery endpoint.
  route("api/config", "routes/api.config.ts"),
  // Authenticated app shell (AppProvider + Polaris Frame + navigation).
  layout("routes/app.tsx", [
    route("app", "routes/app/_index.tsx"),
    route("app/filters", "routes/app/filters.tsx"),
    route("app/appearance", "routes/app/appearance.tsx"),
    route("app/mobile", "routes/app/mobile.tsx"),
    route("app/performance", "routes/app/performance.tsx"),
    route("app/settings", "routes/app/settings.tsx"),
    route("app/diagnostics", "routes/app/diagnostics.tsx"),
  ]),
];

export default routes;
