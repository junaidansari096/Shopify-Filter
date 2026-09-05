import { useLoaderData, useFetcher } from "react-router";
import { Page, Layout, Card, Text, BlockStack, TextField, Checkbox, InlineStack, Banner } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../../shopify.server";
import { ensureShop } from "../../services/shop.server";
import { getAppearance, saveAppearance, appearanceSchema } from "../../services/filters.server";

interface LoaderData {
  appearance: {
    sidebarWidth: number;
    headingSize: string;
    optionFontSize: string;
    showDivider: boolean;
    dividerStrength: string;
    checkboxRadius: string;
    checkboxSize: string;
    accentColor: string;
    textColor: string;
    mutedTextColor: string;
    borderColor: string;
    selectedColor: string;
    panelBackground: string;
    panelRadius: string;
    spacing: string;
    stickyDesktop: boolean;
    stickyTopOffset: number;
    mobileBreakpoint: number;
  };
  css: string;
}

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);
  const appearance = (await getAppearance(shop.id)) ?? {
    sidebarWidth: 260,
    headingSize: "16px",
    optionFontSize: "14px",
    showDivider: true,
    dividerStrength: "1px",
    checkboxRadius: "4px",
    checkboxSize: "18px",
    accentColor: "#032443",
    textColor: "#1F2937",
    mutedTextColor: "#6B7280",
    borderColor: "#E5E7EB",
    selectedColor: "#032443",
    panelBackground: "#FFFFFF",
    panelRadius: "8px",
    spacing: "16px",
    stickyDesktop: true,
    stickyTopOffset: 80,
    mobileBreakpoint: 990,
  };

  const css = buildCssFromAppearance(appearance);

  return { appearance, css } satisfies LoaderData;
}

export async function action({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);
  const formData = await request.formData();

  const input = {
    sidebarWidth: Number(formData.get("sidebarWidth")) || 260,
    headingSize: String(formData.get("headingSize") || "16px"),
    optionFontSize: String(formData.get("optionFontSize") || "14px"),
    showDivider: formData.get("showDivider") === "on",
    dividerStrength: String(formData.get("dividerStrength") || "1px"),
    checkboxRadius: String(formData.get("checkboxRadius") || "4px"),
    checkboxSize: String(formData.get("checkboxSize") || "18px"),
    accentColor: String(formData.get("accentColor") || "#032443"),
    textColor: String(formData.get("textColor") || "#1F2937"),
    mutedTextColor: String(formData.get("mutedTextColor") || "#6B7280"),
    borderColor: String(formData.get("borderColor") || "#E5E7EB"),
    selectedColor: String(formData.get("selectedColor") || "#032443"),
    panelBackground: String(formData.get("panelBackground") || "#FFFFFF"),
    panelRadius: String(formData.get("panelRadius") || "8px"),
    spacing: String(formData.get("spacing") || "16px"),
    stickyDesktop: formData.get("stickyDesktop") === "on",
    stickyTopOffset: Number(formData.get("stickyTopOffset")) || 80,
    mobileBreakpoint: Number(formData.get("mobileBreakpoint")) || 990,
  };

  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
    };
  }

  await saveAppearance(shop.id, parsed.data);
  return { ok: true };
}

function buildCssFromAppearance(a: LoaderData["appearance"]): string {
  return [
    ".fresheek-filters {",
    `  --ff-accent: ${a.accentColor};`,
    `  --ff-sidebar-width: ${a.sidebarWidth}px;`,
    `  --ff-heading-size: ${a.headingSize};`,
    `  --ff-option-font-size: ${a.optionFontSize};`,
    `  --ff-divider-visible: ${a.showDivider ? "1" : "0"};`,
    `  --ff-divider-width: ${a.dividerStrength};`,
    `  --ff-checkbox-radius: ${a.checkboxRadius};`,
    `  --ff-checkbox-size: ${a.checkboxSize};`,
    `  --ff-text: ${a.textColor};`,
    `  --ff-muted: ${a.mutedTextColor};`,
    `  --ff-border: ${a.borderColor};`,
    `  --ff-selected: ${a.selectedColor};`,
    `  --ff-panel-bg: ${a.panelBackground};`,
    `  --ff-panel-radius: ${a.panelRadius};`,
    `  --ff-spacing: ${a.spacing};`,
    `  --ff-sticky-offset: ${a.stickyTopOffset}px;`,
    `  --ff-mobile-breakpoint: ${a.mobileBreakpoint}px;`,
    "}",
  ].join("\n");
}

const COLOR_PRESETS = [
  { name: "Horizon Navy", accent: "#032443", text: "#1F2937", bg: "#FFFFFF", border: "#E5E7EB" },
  { name: "Emerald Forest", accent: "#047857", text: "#064E3B", bg: "#F0FDF4", border: "#A7F3D0" },
  { name: "Royal Blue", accent: "#1D4ED8", text: "#1E3A8A", bg: "#EFF6FF", border: "#BFDBFE" },
  { name: "Sunset Ember", accent: "#EA580C", text: "#7C2D12", bg: "#FFF7ED", border: "#FED7AA" },
  { name: "Midnight Charcoal", accent: "#18181B", text: "#27272A", bg: "#FAFAFA", border: "#E4E4E7" },
  { name: "Berry Rose", accent: "#E11D48", text: "#881337", bg: "#FFF1F2", border: "#FECDD3" },
];

export default function AppearancePage() {
  const { appearance, css } = useLoaderData<LoaderData>();
  const [form, setForm] = useState(appearance);

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

  function set<K extends keyof LoaderData["appearance"]>(key: K, value: LoaderData["appearance"][K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: (typeof COLOR_PRESETS)[number]) {
    setForm((prev) => ({
      ...prev,
      accentColor: preset.accent,
      selectedColor: preset.accent,
      textColor: preset.text,
      panelBackground: preset.bg,
      borderColor: preset.border,
    }));
  }

  function handleSave() {
    setShowSaved(false);
    const data = new FormData();
    data.set("sidebarWidth", String(form.sidebarWidth));
    data.set("headingSize", form.headingSize);
    data.set("optionFontSize", form.optionFontSize);
    data.set("showDivider", form.showDivider ? "on" : "off");
    data.set("dividerStrength", form.dividerStrength);
    data.set("checkboxRadius", form.checkboxRadius);
    data.set("checkboxSize", form.checkboxSize);
    data.set("accentColor", form.accentColor);
    data.set("textColor", form.textColor);
    data.set("mutedTextColor", form.mutedTextColor);
    data.set("borderColor", form.borderColor);
    data.set("selectedColor", form.selectedColor);
    data.set("panelBackground", form.panelBackground);
    data.set("panelRadius", form.panelRadius);
    data.set("spacing", form.spacing);
    data.set("stickyDesktop", form.stickyDesktop ? "on" : "off");
    data.set("stickyTopOffset", String(form.stickyTopOffset));
    data.set("mobileBreakpoint", String(form.mobileBreakpoint));

    fetcher.submit(data, { method: "POST" });
  }

  return (
    <Page
      title="Appearance & Styling"
      subtitle="Customize colors, dimensions, typography, and checkboxes with real-time live preview."
      primaryAction={{
        content: isSaving ? "Saving..." : "Save appearance",
        onAction: handleSave,
        loading: isSaving,
        disabled: isSaving,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {fetcher.data && !fetcher.data.ok && (
              <Banner tone="critical" title="Failed to save appearance">
                {fetcher.data.error || "An unknown error occurred."}
              </Banner>
            )}
            {showSaved && (
              <Banner tone="success" onDismiss={() => setShowSaved(false)}>
                Appearance styles saved and applied to your storefront.
              </Banner>
            )}

            {/* Presets */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Curated Color Themes</Text>
                <Text as="p" tone="subdued">Click any palette below to instantly apply matching color combinations.</Text>
                <InlineStack gap="200" wrap>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: form.accentColor === p.accent ? "2px solid #000" : "1px solid #d1d5db",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: p.accent }} />
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{p.name}</span>
                    </button>
                  ))}
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Colors */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Custom Color Palette</Text>
                <ColorField label="Accent color (Price slider, buttons, active checkboxes)" value={form.accentColor} onChange={(v) => set("accentColor", v)} />
                <ColorField label="Primary text color" value={form.textColor} onChange={(v) => set("textColor", v)} />
                <ColorField label="Muted text color (Counters, inactive labels)" value={form.mutedTextColor} onChange={(v) => set("mutedTextColor", v)} />
                <ColorField label="Border / Divider color" value={form.borderColor} onChange={(v) => set("borderColor", v)} />
                <ColorField label="Panel background color" value={form.panelBackground} onChange={(v) => set("panelBackground", v)} />
              </BlockStack>
            </Card>

            {/* Layout Dimensions */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Layout Dimensions & Behavior</Text>
                <TextField
                  label="Sidebar width (px)"
                  type="number"
                  helpText="Sets the exact width of the filter sidebar on desktop. Default: 260px (Supports 180px - 450px)."
                  value={String(form.sidebarWidth)}
                  onChange={(v) => set("sidebarWidth", Number(v) || 260)}
                  autoComplete="off"
                />
                <TextField
                  label="Spacing between filter groups"
                  helpText="Example: 12px, 16px, 20px, 24px."
                  value={form.spacing}
                  onChange={(v) => set("spacing", v)}
                  autoComplete="off"
                />
                <TextField
                  label="Sticky top offset (px)"
                  type="number"
                  helpText="Offset from the viewport top when sticky scrolling is active."
                  value={String(form.stickyTopOffset)}
                  onChange={(v) => set("stickyTopOffset", Number(v) || 80)}
                  autoComplete="off"
                />
                <Checkbox
                  label="Sticky sidebar on desktop"
                  helpText="Keeps the filter sidebar visible as the customer scrolls through the catalog."
                  checked={form.stickyDesktop}
                  onChange={(c) => set("stickyDesktop", c)}
                />
              </BlockStack>
            </Card>

            {/* Typography & Checkbox style */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Typography & Controls</Text>
                <InlineStack gap="400" wrap={false}>
                  <div style={{ flex: 1 }}>
                    <TextField label="Heading size" value={form.headingSize} onChange={(v) => set("headingSize", v)} autoComplete="off" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField label="Option text size" value={form.optionFontSize} onChange={(v) => set("optionFontSize", v)} autoComplete="off" />
                  </div>
                </InlineStack>
                <InlineStack gap="400" wrap={false}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Checkbox size"
                      helpText="e.g. 16px, 18px, 20px"
                      value={form.checkboxSize}
                      onChange={(v) => set("checkboxSize", v)}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Checkbox radius"
                      helpText="0px for sharp, 4px for rounded, 999px for circle"
                      value={form.checkboxRadius}
                      onChange={(v) => set("checkboxRadius", v)}
                      autoComplete="off"
                    />
                  </div>
                </InlineStack>
                <Checkbox
                  label="Show horizontal dividers between filter groups"
                  checked={form.showDivider}
                  onChange={(c) => set("showDivider", c)}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Live Interactive Preview Column */}
        <Layout.Section variant="oneThird">
          <div style={{ position: "sticky", top: "20px" }}>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Live Storefront Preview</Text>
                  <span style={{ fontSize: "11px", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: "12px" }}>
                    {form.sidebarWidth}px
                  </span>
                </InlineStack>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Updates instantly as you adjust styling controls.
                </Text>

                {/* Mock Filter Container */}
                <div
                  style={{
                    width: "100%",
                    background: form.panelBackground,
                    border: `1px solid ${form.borderColor}`,
                    borderRadius: form.panelRadius || "8px",
                    padding: "16px",
                    color: form.textColor,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    boxBox: "border-box",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: `1px solid ${form.borderColor}` }}>
                    <span style={{ fontSize: form.headingSize, fontWeight: 700, color: form.accentColor }}>Filters</span>
                    <span style={{ fontSize: "12px", color: form.accentColor, fontWeight: 600, cursor: "pointer" }}>Clear all</span>
                  </div>

                  {/* Active chip */}
                  <div style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        background: "#f3f4f6",
                        border: `1px solid ${form.borderColor}`,
                        borderRadius: "16px",
                        fontSize: "11px",
                        fontWeight: 500,
                      }}
                    >
                      In stock <span style={{ color: form.mutedTextColor }}>✕</span>
                    </span>
                  </div>

                  {/* Filter Group 1: Availability */}
                  <div style={{ marginTop: form.spacing }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: form.headingSize, fontWeight: 600, marginBottom: "8px" }}>
                      <span>Availability</span>
                      <span style={{ fontSize: "12px", color: form.mutedTextColor }}>▾</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <div
                        style={{
                          width: form.checkboxSize,
                          height: form.checkboxSize,
                          borderRadius: form.checkboxRadius,
                          background: form.accentColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                      <span style={{ fontSize: form.optionFontSize, flex: 1 }}>In stock</span>
                      <span style={{ fontSize: "12px", color: form.mutedTextColor }}>(11)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: form.checkboxSize,
                          height: form.checkboxSize,
                          borderRadius: form.checkboxRadius,
                          border: `1.5px solid ${form.borderColor}`,
                          background: "#fff",
                        }}
                      />
                      <span style={{ fontSize: form.optionFontSize, flex: 1 }}>Out of stock</span>
                      <span style={{ fontSize: "12px", color: form.mutedTextColor }}>(52)</span>
                    </div>
                  </div>

                  {form.showDivider && <div style={{ height: form.dividerStrength, background: form.borderColor, margin: `${form.spacing} 0` }} />}

                  {/* Filter Group 2: Price with Connected Slider */}
                  <div style={{ marginTop: form.showDivider ? "0" : form.spacing }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: form.headingSize, fontWeight: 600, marginBottom: "10px" }}>
                      <span>Price</span>
                      <span style={{ fontSize: "12px", color: form.mutedTextColor }}>▾</span>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ flex: 1, border: `1px solid ${form.borderColor}`, borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }}>
                        ₹ 0
                      </div>
                      <span style={{ fontSize: "11px", color: form.mutedTextColor }}>to</span>
                      <div style={{ flex: 1, border: `1px solid ${form.borderColor}`, borderRadius: "4px", padding: "4px 8px", fontSize: "12px" }}>
                        ₹ 7448
                      </div>
                    </div>

                    {/* Connected Slider Preview */}
                    <div style={{ position: "relative", height: "20px", display: "flex", alignItems: "center", margin: "6px 0 10px 0" }}>
                      <div style={{ position: "absolute", left: 0, right: 0, height: "4px", background: "#e5e7eb", borderRadius: "2px" }} />
                      <div style={{ position: "absolute", left: "0%", right: "0%", height: "4px", background: form.accentColor, borderRadius: "2px" }} />
                      <div style={{ position: "absolute", left: 0, width: "16px", height: "16px", borderRadius: "50%", background: "#fff", border: `2px solid ${form.accentColor}`, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      <div style={{ position: "absolute", right: 0, width: "16px", height: "16px", borderRadius: "50%", background: "#fff", border: `2px solid ${form.accentColor}`, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </div>

                    <button
                      type="button"
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: form.accentColor,
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: form.optionFontSize,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Apply filters
                    </button>
                  </div>
                </div>
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <InlineStack gap="300" blockAlign="center">
      <input
        type="color"
        value={value.startsWith("#") ? value : "#032443"}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "40px",
          height: "40px",
          padding: "2px",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          cursor: "pointer",
          backgroundColor: "#fff",
        }}
      />
      <div style={{ flex: 1 }}>
        <TextField label={label} value={value} onChange={onChange} autoComplete="off" />
      </div>
    </InlineStack>
  );
}
