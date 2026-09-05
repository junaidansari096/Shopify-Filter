import { Page, Layout, Card, Text, BlockStack, Banner } from "@shopify/polaris";
import { authenticate } from "../../shopify.server";
import { ensureShop } from "../../services/shop.server";

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  await ensureShop(admin.graphql, shopDomain);
  return {};
}

export default function PerformancePage() {
  return (
    <Page
      title="Performance"
      subtitle="How the storefront filters behave on shoppers' devices."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Banner tone="info">
                Fresheek Filters is architected for performance by default. No
                heavy JavaScript framework ships to collection pages. Minimize
                layout shifts already configured in Appearance.
              </Banner>
              <Text as="h2" variant="headingMd">Built-in performance guarantees</Text>
              <Text as="p">
                The storefront filter uses:
              </Text>
              <BlockStack>
                <Text as="p">• Server-side Shopify section refreshing (no product catalog download).</Text>
                <Text as="p">• Lightweight vanilla TypeScript with no React on collection pages.</Text>
                <Text as="p">• Request cancellation with AbortController to prevent stale responses.</Text>
                <Text as="p">• A bounded in-memory cache for recently requested filter URLs.</Text>
                <Text as="p">• Event delegation instead of dozens of individual listeners.</Text>
                <Text as="p">• Keeps existing products visible during loading (no blank grid).</Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
