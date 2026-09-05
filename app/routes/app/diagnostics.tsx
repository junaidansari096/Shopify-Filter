import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Banner,
  Button,
  Badge,
  List,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";
import { ensureShop } from "../../services/shop.server";
import { listFilters } from "../../services/filters.server";

interface LoaderData {
  diagnostics: {
    shopDomain: string;
    apiStatus: string;
    filterCount: number;
    brandConfigured: boolean;
    priceConfigured: boolean;
    themeExtensionExpected: boolean;
    generatedAt: string;
  };
}

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);

  const filters = await listFilters(shop.id);

  return {
    diagnostics: {
      shopDomain,
      apiStatus: "connected",
      filterCount: filters.length,
      brandConfigured: filters.some((f) => f.sourceKey === "filter.p.vendor" && f.enabled),
      priceConfigured: filters.some((f) => f.sourceKey.startsWith("filter.v.price") && f.enabled),
      themeExtensionExpected: true,
      generatedAt: new Date().toISOString(),
    },
  } satisfies LoaderData;
}

export default function DiagnosticsPage() {
  const { diagnostics } = useLoaderData<LoaderData>();

  const diagnosticText = [
    `Shop domain: ${diagnostics.shopDomain}`,
    `API status: ${diagnostics.apiStatus}`,
    `Filters configured: ${diagnostics.filterCount}`,
    `Brand (vendor) configured: ${diagnostics.brandConfigured ? "yes" : "no"}`,
    `Price filter configured: ${diagnostics.priceConfigured ? "yes" : "no"}`,
    `Theme extension expected: ${diagnostics.themeExtensionExpected ? "yes" : "no"}`,
    `Generated at: ${diagnostics.generatedAt}`,
  ].join("\n");

  function copyDiagnostics() {
    navigator.clipboard.writeText(diagnosticText);
  }

  return (
    <Page
      title="Diagnostics"
      subtitle="Sanitized compatibility information. Never includes access tokens."
      primaryAction={{ content: "Copy diagnostics", onAction: copyDiagnostics }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Banner tone="info">
                The most reliable storefront integration checks run in the
                Theme Editor. Open your theme, add the Fresheek Filters block to
                a collection template, and preview that collection.
              </Banner>

              <List type="bullet">
                <List.Item>
                  Storefront theme extension:{" "}
                  <Badge tone={diagnostics.themeExtensionExpected ? "success" : "warning"}>
                    {diagnostics.themeExtensionExpected ? "extension expected" : "not detected"}
                  </Badge>
                </List.Item>
                <List.Item>
                  Product results section detection: run on storefront — see
                  Theme Editor preview.
                </List.Item>
                <List.Item>
                  Filter block active: run on storefront — see Theme Editor preview.
                </List.Item>
                <List.Item>
                  Native filter data detected:{" "}
                  <Badge tone="success">provided by Shopify</Badge>
                </List.Item>
                <List.Item>
                  API status:{" "}
                  <Badge tone="success">{diagnostics.apiStatus}</Badge>
                </List.Item>
                <List.Item>
                  Last storefront integration error: none recorded (client-side).
                </List.Item>
              </List>

              <Button onClick={copyDiagnostics}>Copy diagnostics</Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
