import { useLoaderData, useFetcher } from "react-router";
import { Page, Layout, Card, BlockStack, TextField, Banner, ChoiceList, Checkbox, Text } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { authenticate } from "../../shopify.server";
import { ensureShop } from "../../services/shop.server";
import {
  getAppearance,
  updateAppearance,
  getAppSettings,
  updateAppSettings,
  mobileSettingsSchema,
} from "../../services/filters.server";

export async function loader({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);
  const [appearance, settings] = await Promise.all([
    getAppearance(shop.id),
    getAppSettings(shop.id),
  ]);

  return {
    mobileBreakpoint: appearance?.mobileBreakpoint ?? 990,
    stickyTopOffset: appearance?.stickyTopOffset ?? 80,
    mobileDrawerPosition: settings?.mobileDrawerPosition ?? "right",
    mobileTriggerText: settings?.mobileTriggerText ?? "Filters",
    mobileButtonVariant: settings?.mobileButtonVariant ?? "outline",
    mobileShowProductCount: settings?.mobileShowProductCount ?? true,
  };
}

export async function action({ request }: { request: Request }) {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session?.shop ?? "";
  const shop = await ensureShop(admin.graphql, shopDomain);
  const formData = await request.formData();

  const mobileBreakpoint = Number(formData.get("mobileBreakpoint")) || 990;
  const stickyTopOffset = Number(formData.get("stickyTopOffset")) || 80;
  const mobileDrawerPosition = (formData.get("mobileDrawerPosition") as "right" | "left") || "right";
  const mobileTriggerText = String(formData.get("mobileTriggerText") || "Filters").trim();
  const mobileButtonVariant = (formData.get("mobileButtonVariant") as "outline" | "solid") || "outline";
  const mobileShowProductCount = formData.get("mobileShowProductCount") === "on";

  await Promise.all([
    updateAppearance(shop.id, { mobileBreakpoint, stickyTopOffset }),
    updateAppSettings(shop.id, {
      mobileDrawerPosition,
      mobileTriggerText,
      mobileButtonVariant,
      mobileShowProductCount,
    }),
  ]);

  return { ok: true };
}

export default function MobilePage() {
  const data = useLoaderData<typeof loader>();
  const [form, setForm] = useState({
    breakpoint: data.mobileBreakpoint,
    offset: data.stickyTopOffset,
    drawerPosition: data.mobileDrawerPosition,
    triggerText: data.mobileTriggerText,
    buttonVariant: data.mobileButtonVariant,
    showProductCount: data.mobileShowProductCount,
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
    fd.set("mobileBreakpoint", String(form.breakpoint));
    fd.set("stickyTopOffset", String(form.offset));
    fd.set("mobileDrawerPosition", form.drawerPosition);
    fd.set("mobileTriggerText", form.triggerText);
    fd.set("mobileButtonVariant", form.buttonVariant);
    fd.set("mobileShowProductCount", form.showProductCount ? "on" : "off");
    fetcher.submit(fd, { method: "POST" });
  }

  return (
    <Page
      title="Mobile filters"
      subtitle="Customize how filters look and behave on mobile phones and tablets."
      primaryAction={{
        content: isSaving ? "Saving..." : "Save mobile settings",
        onAction: handleSave,
        loading: isSaving,
        disabled: isSaving,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {fetcher.data && !fetcher.data.ok && (
              <Banner tone="critical" title="Failed to save mobile settings">
                {fetcher.data.error || "An unknown error occurred."}
              </Banner>
            )}

            {showSaved && (
              <Banner tone="success" onDismiss={() => setShowSaved(false)}>
                Mobile settings saved successfully and live on your storefront.
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Filter Drawer Animation & Position</Text>
                <ChoiceList
                  title="Drawer slide direction"
                  choices={[
                    {
                      label: "Slide in from Right (Standard)",
                      value: "right",
                      helpText: "Smoothly slides in from the right edge of the screen.",
                    },
                    {
                      label: "Slide in from Left",
                      value: "left",
                      helpText: "Slides in from the left edge like a traditional sidebar.",
                    },
                  ]}
                  selected={[form.drawerPosition]}
                  onChange={(selected) => set("drawerPosition", selected[0] as "right" | "left")}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Mobile Trigger Button Style</Text>
                <TextField
                  label="Button label text"
                  helpText="The text displayed on the mobile filter trigger button."
                  value={form.triggerText}
                  onChange={(v) => set("triggerText", v)}
                  autoComplete="off"
                />

                <ChoiceList
                  title="Button visual style"
                  choices={[
                    {
                      label: "Outline (Clean 1.5px accent border with panel background)",
                      value: "outline",
                    },
                    {
                      label: "Solid (Full filled accent background with white text)",
                      value: "solid",
                    },
                  ]}
                  selected={[form.buttonVariant]}
                  onChange={(selected) => set("buttonVariant", selected[0] as "outline" | "solid")}
                />

                <Checkbox
                  label="Show product count in mobile toolbar"
                  helpText="Displays total matching products count beside the filter button on mobile screens."
                  checked={form.showProductCount}
                  onChange={(c) => set("showProductCount", c)}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Responsive Breakpoint</Text>
                <TextField
                  label="Mobile breakpoint (px)"
                  type="number"
                  helpText="Screens narrower than this width switch from desktop sidebar to mobile drawer. Default is 990px."
                  value={String(form.breakpoint)}
                  onChange={(v) => set("breakpoint", Number(v) || 990)}
                  autoComplete="off"
                />
                <TextField
                  label="Sticky top offset (px)"
                  type="number"
                  helpText="Offset from viewport top when header is sticky."
                  value={String(form.offset)}
                  onChange={(v) => set("offset", Number(v) || 0)}
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
