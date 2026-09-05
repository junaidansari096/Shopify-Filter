import { useLoaderData, useFetcher } from "react-router";
import { Page, Layout, Card, BlockStack, TextField, Checkbox, Banner, ChoiceList, Text, Divider } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../../shopify.server";
import { ensureShop } from "../../services/shop.server";
import { getAppSettings, updateAppSettings, appSettingsSchema } from "../../services/filters.server";

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);
  const settings = await getAppSettings(shop.id);

  return {
    showProductCount: settings?.showProductCount ?? true,
    showActiveFilters: settings?.showActiveFilters ?? true,
    productGridSelector: settings?.productGridSelector ?? "",
    resultsSectionSelector: settings?.resultsSectionSelector ?? "",
    paginationMode: settings?.paginationMode ?? "infinite",
  };
}

export async function action({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);
  const formData = await request.formData();

  const updateData = {
    showProductCount: formData.get("showProductCount") === "on",
    showActiveFilters: formData.get("showActiveFilters") === "on",
    productGridSelector: String(formData.get("productGridSelector") ?? ""),
    resultsSectionSelector: String(formData.get("resultsSectionSelector") ?? ""),
    paginationMode: (formData.get("paginationMode") as "infinite" | "pagination") ?? "infinite",
  };

  await updateAppSettings(shop.id, updateData);
  return { ok: true };
}

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const [form, setForm] = useState({
    showProductCount: data.showProductCount,
    showActiveFilters: data.showActiveFilters,
    productGridSelector: data.productGridSelector,
    resultsSectionSelector: data.resultsSectionSelector,
    paginationMode: data.paginationMode,
  });

  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isSaving = fetcher.state === "submitting";
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (fetcher.data?.ok) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setShowSaved(false);
    const fd = new FormData();
    fd.set("showProductCount", form.showProductCount ? "on" : "off");
    fd.set("showActiveFilters", form.showActiveFilters ? "on" : "off");
    fd.set("productGridSelector", form.productGridSelector);
    fd.set("resultsSectionSelector", form.resultsSectionSelector);
    fd.set("paginationMode", form.paginationMode);
    fetcher.submit(fd, { method: "POST" });
  }

  return (
    <Page
      title="Settings"
      subtitle="Storefront catalog browsing, pagination mode, and theme compatibility."
      primaryAction={{
        content: isSaving ? "Saving..." : "Save settings",
        onAction: handleSave,
        loading: isSaving,
        disabled: isSaving,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {fetcher.data && !fetcher.data.ok && (
              <Banner tone="critical" title="Failed to save settings">
                {fetcher.data.error || "An unknown error occurred."}
              </Banner>
            )}

            {showSaved && (
              <Banner tone="success" onDismiss={() => setShowSaved(false)}>
                Settings saved successfully and updated on your storefront.
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Catalog Browsing & Pagination</Text>
                <Text as="p" tone="subdued">
                  Choose how shoppers browse through large product collections.
                </Text>

                <ChoiceList
                  title="Catalog loading mode"
                  choices={[
                    {
                      label: "Infinite Scrolling (Recommended)",
                      value: "infinite",
                      helpText: "Products load automatically as the shopper scrolls down. Eliminates 1, 2, 3, 4 page clicking.",
                    },
                    {
                      label: "Standard Pagination",
                      value: "pagination",
                      helpText: "Classic numbered pagination (1, 2, 3, 4, >) at the bottom of the collection grid.",
                    },
                  ]}
                  selected={[form.paginationMode]}
                  onChange={(selected) => set("paginationMode", selected[0] as "infinite" | "pagination")}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Storefront Elements</Text>
                <Checkbox
                  label="Show product count"
                  helpText="Displays total matching products count in the header and mobile toolbar."
                  checked={form.showProductCount}
                  onChange={(c) => set("showProductCount", c)}
                />
                <Checkbox
                  label="Show active filter chips"
                  helpText="Displays removable filter tags with a 'Clear all' button above the filters."
                  checked={form.showActiveFilters}
                  onChange={(c) => set("showActiveFilters", c)}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Theme Compatibility (Advanced)</Text>
                <Text as="p" tone="subdued">
                  These selectors are automatically detected for Horizon and Dawn themes. Override only if using custom third-party themes.
                </Text>
                <TextField
                  label="Product grid CSS selector"
                  helpText="Example: .collection__grid or #product-grid. Leave empty for automatic detection."
                  value={form.productGridSelector}
                  onChange={(v) => set("productGridSelector", v)}
                  autoComplete="off"
                />
                <TextField
                  label="Results section CSS selector"
                  helpText="Example: [data-section-id='main-collection']"
                  value={form.resultsSectionSelector}
                  onChange={(v) => set("resultsSectionSelector", v)}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
