import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  BlockStack,
  Button,
  Badge,
  TextField,
  ChoiceList,
  Checkbox,
  InlineStack,
  DataTable,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../../shopify.server";
import { ensureShop } from "../../services/shop.server";
import { detectAvailableFilters } from "../../services/filterDetection.server";
import { listFilters, replaceFilters, filterConfigsBulkSchema } from "../../services/filters.server";
import type { FilterPresentation } from "../../types";

const presentationOptions: Array<{ label: string; value: FilterPresentation }> = [
  { label: "Checkbox list", value: "checkbox-list" },
  { label: "Radio list", value: "radio-list" },
  { label: "Swatches", value: "swatches" },
  { label: "Price range", value: "price-range" },
  { label: "Boolean", value: "boolean" },
  { label: "Image", value: "image" },
  { label: "Pills", value: "pills" },
];

interface LoaderData {
  configs: Array<{
    id: string;
    sourceKey: string;
    label: string;
    enabled: boolean;
    presentation: FilterPresentation;
    searchable: boolean;
    showCounts: boolean;
    initialVisibleCount: number;
    showMore: boolean;
    expandedDesktop: boolean;
    expandedMobile: boolean;
    position: number;
  }>;
  available: Array<{
    sourceType: string;
    sourceKey: string;
    label: string;
    description: string;
    optionCount: number;
    sampleOptions: string[];
  }>;
}

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);
  const configs = await listFilters(shop.id);
  const available = await detectAvailableFilters(admin.graphql);

  return {
    configs: configs.map((c) => ({
      id: c.id,
      sourceKey: c.sourceKey,
      label: c.label,
      enabled: c.enabled,
      presentation: (c.presentation as FilterPresentation) ?? "checkbox-list",
      searchable: c.searchable,
      showCounts: c.showCounts,
      initialVisibleCount: c.initialVisibleCount,
      showMore: c.showMore,
      expandedDesktop: c.expandedDesktop,
      expandedMobile: c.expandedMobile,
      position: c.position,
    })),
    available,
  } satisfies LoaderData;
}

export async function action({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);

  const formData = await request.formData();
  const raw = formData.get("filters");

  if (typeof raw !== "string") {
    return { ok: false, error: "No filter data provided." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid filter data JSON." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Invalid filter list; expected an array." };
  }

  const result = filterConfigsBulkSchema.safeParse({ filters: parsed });
  if (!result.success) {
    const errorMsg = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    return { ok: false, error: errorMsg };
  }

  try {
    await replaceFilters(shop.id, result.data.filters);
    return { ok: true };
  } catch (error) {
    console.error("Filters action failed", error);
    return { ok: false, error: "Failed to save filters to database." };
  }
}

export default function FiltersPage() {
  const { configs: initialConfigs, available } = useLoaderData<LoaderData>();
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const saving = fetcher.state === "submitting";
  const [showSaved, setShowSaved] = useState(false);

  const [configs, setConfigs] = useState(initialConfigs);
  const [customLabel, setCustomLabel] = useState("");
  const [customKey, setCustomKey] = useState("");

  useEffect(() => {
    if (fetcher.data?.ok) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data]);

  function updateConfig(id: string, patch: Partial<LoaderData["configs"][number]>) {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function handleCreateCustomFilter() {
    const key = customKey.trim();
    const label = customLabel.trim();
    if (!key || !label) return;
    if (configs.some((c) => c.sourceKey === key)) return;

    setConfigs((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        sourceKey: key,
        label: label,
        enabled: true,
        presentation: key.includes("price") ? "price-range" : "checkbox-list",
        searchable: false,
        showCounts: true,
        initialVisibleCount: 8,
        showMore: true,
        expandedDesktop: true,
        expandedMobile: false,
        position: prev.length,
      },
    ]);
    setCustomLabel("");
    setCustomKey("");
  }

  function addFilter(sourceKey: string) {
    if (configs.some((c) => c.sourceKey === sourceKey)) return;
    const availableItem = available.find((a) => a.sourceKey === sourceKey);
    if (!availableItem) return;
    const defaultPresentation: FilterPresentation =
      availableItem.sourceType === "vendor" || availableItem.sourceType === "product_type"
        ? "checkbox-list"
        : "checkbox-list";
    setConfigs((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        sourceKey,
        label: availableItem.sourceType === "vendor" ? "Brand" : availableItem.label,
        enabled: true,
        presentation: defaultPresentation,
        searchable: availableItem.sourceType === "vendor",
        showCounts: true,
        initialVisibleCount: 8,
        showMore: true,
        expandedDesktop: true,
        expandedMobile: false,
        position: prev.length,
      },
    ]);
  }

  function removeFilter(id: string) {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    setConfigs((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (!removed) return prev;
      next.splice(target, 0, removed);
      return next;
    });
  }

  function handleSave() {
    setShowSaved(false);
    const payload = configs.map((c) => ({
      sourceKey: c.sourceKey,
      label: c.label,
      enabled: c.enabled,
      presentation: c.presentation,
      searchable: c.searchable,
      showCounts: c.showCounts,
      initialVisibleCount: c.initialVisibleCount,
      showMore: c.showMore,
      expandedDesktop: c.expandedDesktop,
      expandedMobile: c.expandedMobile,
    }));

    const form = new FormData();
    form.set("filters", JSON.stringify(payload));
    fetcher.submit(form, { method: "POST" });
  }

  return (
    <Page
      title="Filters"
      subtitle="Configure which filters appear on collection and search pages."
      primaryAction={{
        content: saving ? "Saving…" : "Save filters",
        loading: saving,
        onAction: handleSave,
        disabled: saving,
      }}
    >
      <Layout>
        <Layout.Section>
          {fetcher.data && !fetcher.data.ok && (
            <Banner tone="critical" title="Failed to save filters">
              {fetcher.data.error || "An unknown error occurred."}
            </Banner>
          )}
          {showSaved && (
            <Banner tone="success" onDismiss={() => setShowSaved(false)}>
              Filters saved successfully.
            </Banner>
          )}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Configured filters
              </Text>
              {configs.length === 0 ? (
                <Text as="p" tone="subdued">
                  No filters configured yet. Add filters from the "Available filters"
                  section below.
                </Text>
              ) : (
                configs.map((config) => (
                  <Card key={config.id}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack>
                          <Text as="h3" variant="headingSm">
                            {config.label}
                          </Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            Source: {config.sourceKey}
                          </Text>
                        </BlockStack>
                        <InlineStack gap="200">
                          <Button size="slim" onClick={() => move(config.id, -1)}>
                            ↑
                          </Button>
                          <Button size="slim" onClick={() => move(config.id, 1)}>
                            ↓
                          </Button>
                          <Button
                            size="slim"
                            tone="critical"
                            onClick={() => removeFilter(config.id)}
                          >
                            Remove
                          </Button>
                        </InlineStack>
                      </InlineStack>

                      <TextField
                        label="Visible label"
                        value={config.label}
                        onChange={(value) => updateConfig(config.id, { label: value })}
                        autoComplete="off"
                      />

                      <ChoiceList
                        title="Presentation"
                        choices={presentationOptions.map((p) => ({ label: p.label, value: p.value }))}
                        selected={[config.presentation]}
                        onChange={(selected) =>
                          updateConfig(config.id, {
                            presentation: (selected[0] as FilterPresentation) ?? "checkbox-list",
                          })
                        }
                        allowMultiple={false}
                      />

                      <InlineStack gap="400" wrap>
                        <Checkbox
                          label="Enabled"
                          checked={config.enabled}
                          onChange={(checked) => updateConfig(config.id, { enabled: checked })}
                        />
                        <Checkbox
                          label="Search options"
                          checked={config.searchable}
                          onChange={(checked) => updateConfig(config.id, { searchable: checked })}
                        />
                        <Checkbox
                          label="Show counts"
                          checked={config.showCounts}
                          onChange={(checked) => updateConfig(config.id, { showCounts: checked })}
                        />
                        <Checkbox
                          label="Show more / less"
                          checked={config.showMore}
                          onChange={(checked) => updateConfig(config.id, { showMore: checked })}
                        />
                        <Checkbox
                          label="Expanded by default (desktop)"
                          checked={config.expandedDesktop}
                          onChange={(checked) => updateConfig(config.id, { expandedDesktop: checked })}
                        />
                      </InlineStack>

                      <TextField
                        label="Initial visible options"
                        type="number"
                        value={String(config.initialVisibleCount)}
                        onChange={(value) =>
                          updateConfig(config.id, {
                            initialVisibleCount: Math.max(1, Number(value) || 8),
                          })
                        }
                        autoComplete="off"
                      />
                    </BlockStack>
                  </Card>
                ))
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Create Custom Filter / Metafield
              </Text>
              <Text as="p" tone="subdued">
                Add any Shopify filter attribute, product option (Size, Color), tag, or metafield directly by key.
              </Text>

              <InlineStack gap="400" wrap={false}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Filter visible name / title"
                    placeholder="e.g. Size, Color, Fabric, Tag"
                    value={customLabel}
                    onChange={setCustomLabel}
                    autoComplete="off"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Source parameter key"
                    placeholder="e.g. filter.v.option.size or filter.p.tag"
                    value={customKey}
                    onChange={setCustomKey}
                    autoComplete="off"
                  />
                </div>
              </InlineStack>

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleCreateCustomFilter}
                  disabled={!customLabel.trim() || !customKey.trim()}
                >
                  Add custom filter
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Available filters on this store
              </Text>
              <Text as="p" tone="subdued">
                These are the Shopify filter sources detected for this store.
                Select one to add it to your configured filters.
              </Text>
              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text"]}
                headings={["Filter", "Source", "Description", "Options", "Action"]}
                rows={available.map((a) => [
                  a.label,
                  <Badge key={a.sourceKey}>{a.sourceType}</Badge>,
                  a.description,
                  String(a.optionCount || "-"),
                  <Button key={a.sourceKey} size="slim" onClick={() => addFilter(a.sourceKey)}>
                    Add
                  </Button>,
                ])}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
