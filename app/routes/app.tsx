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

  return (
    <AppProvider apiKey={apiKey}>
      <PolarisProvider i18n={POLARIS_I18N}>
        <Frame
          navigation={
            <Navigation location={location.pathname}>
              <Navigation.Section
                items={[
                  { label: "Dashboard", icon: DashboardIcon, onClick: () => navigate("/app") },
                  { label: "Filters", icon: FilterIcon, onClick: () => navigate("/app/filters") },
                  { label: "Appearance", icon: AppearanceIcon, onClick: () => navigate("/app/appearance") },
                  { label: "Mobile", icon: MobileIconBase, onClick: () => navigate("/app/mobile") },
                  { label: "Performance", icon: PerformanceIcon, onClick: () => navigate("/app/performance") },
                  { label: "Settings", icon: SettingsIconBase, onClick: () => navigate("/app/settings") },
                  { label: "Diagnostics", icon: DiagnosticsIcon, onClick: () => navigate("/app/diagnostics") },
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
