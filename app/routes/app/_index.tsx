import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  Banner,
  List,
  Text,
  Badge,
  Button,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";
import { ensureShop } from "../../services/shop.server";
import { graphqlRequest } from "../../services/graphql.server";
import { listFilters } from "../../services/filters.server";

interface GetShopData {
  shop: {
    id: string;
    name: string;
    myshopifyDomain: string;
  };
}

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);

  let shopName = shopDomain;
  try {
    const data = await graphqlRequest<GetShopData>(admin.graphql, "getShop.graphql", {});
    shopName = data.shop.name ?? shopDomain;
  } catch (error) {
    console.error("Dashboard: failed to load shop name", error);
  }

  const filters = await listFilters(shop.id);
  const enabledFilters = filters.filter((f) => f.enabled);
  const brandConfigured = filters.some(
    (f) => f.sourceKey === "filter.p.vendor" && f.enabled,
  );
  const priceConfigured = filters.some(
    (f) => f.sourceKey.startsWith("filter.v.price") && f.enabled,
  );

  return { shopDomain, shopName, enabledCount: enabledFilters.length, brandConfigured, priceConfigured };
}

export default function Dashboard() {
  const { shopDomain, shopName, enabledCount, brandConfigured, priceConfigured } =
    useLoaderData<typeof loader>();

  return (
    <Page
      title="Fresheek Filters"
      subtitle={`Status: Active — ${shopName}`}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Store: {shopDomain}
              </Text>
              <Text as="p" variant="bodyMd">
                {enabledCount} filter{enabledCount === 1 ? "" : "s"} configured for this store.
              </Text>

              <Banner tone="success" title="Setup checklist">
                <List type="bullet">
                  <List.Item>
                    {brandConfigured ? (
                      <Badge tone="success">Brand configured</Badge>
                    ) : (
                      <Badge tone="warning">Brand not configured</Badge>
                    )}
                  </List.Item>
                  <List.Item>
                    {priceConfigured ? (
                      <Badge tone="success">Price filter configured</Badge>
                    ) : (
                      <Badge tone="warning">Price filter not configured</Badge>
                    )}
                  </List.Item>
                  <List.Item>
                    <Badge tone="info">Theme extension</Badge> — add the Fresheek
                    Filters block in the Theme Editor.
                  </List.Item>
                </List>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Quick links
              </Text>
              <Button url="/app/filters">Configure filters</Button>
              <Button url="/app/appearance">Appearance</Button>
              <Button url="/app/diagnostics">Diagnostics</Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
