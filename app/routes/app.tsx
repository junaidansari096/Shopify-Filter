import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useLocation, useNavigate, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { Frame, Navigation, AppProvider as PolarisProvider, type AppProviderProps } from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import { ensureShop } from "../services/shop.server";
import {
  DashboardIcon,
  FilterIcon,
  AppearanceIcon,
  MobileIconBase,
  PerformanceIcon,
  SettingsIconBase,
  DiagnosticsIcon,
} from "../components/icons";

import "@shopify/polaris/build/esm/styles.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  await ensureShop(admin.graphql, shopDomain);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

const POLARIS_I18N: AppProviderProps["i18n"] = {
  Polaris: {
    common: {
      accessibility: {
        increaseDensity: "Increase density",
        decreaseDensity: "Decrease density",
      },
    },
    ResourcePicker: {
      sort: "Sort",
      show: "Show",
      change: "Change",
      viewProduct: "View product",
    },
  },
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = (path: string) => {
    navigate(`${path}${location.search}`);
  };

  return (
    <AppProvider apiKey={apiKey}>
      <ui-nav-menu>
        <a href={`/app${location.search}`} rel="home">Dashboard</a>
        <a href={`/app/filters${location.search}`}>Filters</a>
        <a href={`/app/appearance${location.search}`}>Appearance</a>
        <a href={`/app/mobile${location.search}`}>Mobile</a>
        <a href={`/app/performance${location.search}`}>Performance</a>
        <a href={`/app/settings${location.search}`}>Settings</a>
        <a href={`/app/diagnostics${location.search}`}>Diagnostics</a>
      </ui-nav-menu>
      <PolarisProvider i18n={POLARIS_I18N}>
        <Frame
          navigation={
            <Navigation location={location.pathname}>
              <Navigation.Section
                items={[
                  { label: "Dashboard", icon: DashboardIcon, onClick: () => goTo("/app"), selected: location.pathname === "/app" },
                  { label: "Filters", icon: FilterIcon, onClick: () => goTo("/app/filters"), selected: location.pathname === "/app/filters" },
                  { label: "Appearance", icon: AppearanceIcon, onClick: () => goTo("/app/appearance"), selected: location.pathname === "/app/appearance" },
                  { label: "Mobile", icon: MobileIconBase, onClick: () => goTo("/app/mobile"), selected: location.pathname === "/app/mobile" },
                  { label: "Performance", icon: PerformanceIcon, onClick: () => goTo("/app/performance"), selected: location.pathname === "/app/performance" },
                  { label: "Settings", icon: SettingsIconBase, onClick: () => goTo("/app/settings"), selected: location.pathname === "/app/settings" },
                  { label: "Diagnostics", icon: DiagnosticsIcon, onClick: () => goTo("/app/diagnostics"), selected: location.pathname === "/app/diagnostics" },
                ]}
              />
            </Navigation>
          }
        >
          <Outlet />
        </Frame>
      </PolarisProvider>
    </AppProvider>
  );
}
