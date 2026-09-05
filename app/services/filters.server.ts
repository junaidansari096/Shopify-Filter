import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.server";
import type { StorefrontConfig } from "../types";
import type { FilterPresentation } from "../types";

const presentationValues = [
  "checkbox-list",
  "radio-list",
  "swatches",
  "price-range",
  "boolean",
  "image",
  "pills",
] as const;

export const filterConfigSchema = z.object({
  sourceKey: z.string().min(1, "Source key is required"),
  label: z.string().min(1, "Visible label is required"),
  enabled: z.boolean().default(true),
  presentation: z.enum(presentationValues).default("checkbox-list"),
  searchable: z.boolean().default(false),
  showCounts: z.boolean().default(true),
  initialVisibleCount: z.number().int().min(1).max(100).default(8),
  showMore: z.boolean().default(true),
  expandedDesktop: z.boolean().default(true),
  expandedMobile: z.boolean().default(false),
});

export const filterConfigsBulkSchema = z.object({
  filters: z.array(filterConfigSchema).refine(
    (items) => {
      const keys = new Set<string>();
      for (const item of items) {
        if (keys.has(item.sourceKey)) {
          return false;
        }
        keys.add(item.sourceKey);
      }
      return true;
    },
    { message: "Filter source keys must be unique" },
  ),
});

/**
 * Lists all filter configurations for a shop ordered by position.
 */
export async function listFilters(shopId: string) {
  return prisma.filterConfiguration.findMany({
    where: { shopId },
    orderBy: { position: "asc" },
  });
}

/**
 * Upserts a single filter configuration, keeping the position if provided.
 */
export async function upsertFilter(
  shopId: string,
  input: z.infer<typeof filterConfigSchema>,
  position?: number,
) {
  const existing = await prisma.filterConfiguration.findUnique({
    where: { shopId_sourceKey: { shopId, sourceKey: input.sourceKey } },
  });

  const nextPosition = position ?? existing?.position ?? 0;

  return prisma.filterConfiguration.upsert({
    where: { shopId_sourceKey: { shopId, sourceKey: input.sourceKey } },
    create: { ...input, shopId, position: nextPosition },
    update: { ...input, position: nextPosition },
  });
}

/**
 * Replaces the entire set of filter configurations for a shop in a single
 * transaction. Used by the admin Filters page to persist ordering + settings
 * atomically. `destructureInput` remains inert, but reordering is respected.
 */
export async function replaceFilters(shopId: string, filters: z.infer<typeof filterConfigsBulkSchema>["filters"]) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.filterConfiguration.deleteMany({ where: { shopId } });

    let position = 0;
    for (const filter of filters) {
      await tx.filterConfiguration.create({
        data: { ...filter, shopId, position: position++ },
      });
    }

    return tx.filterConfiguration.findMany({
      where: { shopId },
      orderBy: { position: "asc" },
    });
  });
}

/**
 * Deletes a single filter configuration.
 */
export async function deleteFilter(shopId: string, sourceKey: string) {
  return prisma.filterConfiguration.delete({
    where: { shopId_sourceKey: { shopId, sourceKey } },
  });
}

export const appearanceSchema = z.object({
  sidebarWidth: z.number().int().min(180).max(450).default(260),
  headingSize: z.string().default("16px"),
  optionFontSize: z.string().default("14px"),
  showDivider: z.boolean().default(true),
  dividerStrength: z.string().default("1px"),
  checkboxRadius: z.string().default("4px"),
  checkboxSize: z.string().default("18px"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default("#032443"),
  textColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default("#1F2937"),
  mutedTextColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default("#6B7280"),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default("#E5E7EB"),
  selectedColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default("#032443"),
  panelBackground: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default("#FFFFFF"),
  panelRadius: z.string().default("8px"),
  spacing: z.string().default("16px"),
  stickyDesktop: z.boolean().default(true),
  stickyTopOffset: z.number().int().min(0).max(400).default(80),
  mobileBreakpoint: z.number().int().min(600).max(1600).default(990),
});

export const mobileSettingsSchema = z.object({
  mobileBreakpoint: z.number().int().min(600).max(1600).default(990),
  stickyTopOffset: z.number().int().min(0).max(400).default(80),
});

export async function getAppearance(shopId: string) {
  return prisma.appearanceConfiguration.findUnique({ where: { shopId } });
}

export async function saveAppearance(shopId: string, input: z.infer<typeof appearanceSchema>) {
  return prisma.appearanceConfiguration.upsert({
    where: { shopId },
    create: { ...input, shopId },
    update: { ...input },
  });
}

/**
 * Updates selected appearance fields without overwriting unset fields or resetting sidebarWidth.
 */
export async function updateAppearance(
  shopId: string,
  input: Partial<z.infer<typeof appearanceSchema>>,
) {
  const existing = await getAppearance(shopId);
  const defaults = appearanceSchema.parse({});
  const merged: z.infer<typeof appearanceSchema> = {
    ...defaults,
    ...(existing
      ? {
          sidebarWidth: existing.sidebarWidth,
          headingSize: existing.headingSize,
          optionFontSize: existing.optionFontSize,
          showDivider: existing.showDivider,
          dividerStrength: existing.dividerStrength,
          checkboxRadius: existing.checkboxRadius,
          checkboxSize: existing.checkboxSize,
          accentColor: existing.accentColor,
          textColor: existing.textColor,
          mutedTextColor: existing.mutedTextColor,
          borderColor: existing.borderColor,
          selectedColor: existing.selectedColor,
          panelBackground: existing.panelBackground,
          panelRadius: existing.panelRadius,
          spacing: existing.spacing,
          stickyDesktop: existing.stickyDesktop,
          stickyTopOffset: existing.stickyTopOffset,
          mobileBreakpoint: existing.mobileBreakpoint,
        }
      : {}),
    ...input,
  };

  return saveAppearance(shopId, merged);
}

export const appSettingsSchema = z.object({
  showProductCount: z.boolean().default(true),
  showActiveFilters: z.boolean().default(true),
  productGridSelector: z.string().default(""),
  resultsSectionSelector: z.string().default(""),
  paginationMode: z.enum(["infinite", "pagination"]).default("infinite"),
  mobileDrawerPosition: z.enum(["right", "left"]).default("right"),
  mobileTriggerText: z.string().default("Filters"),
  mobileButtonVariant: z.enum(["outline", "solid"]).default("outline"),
  mobileShowProductCount: z.boolean().default(true),
});

export async function getAppSettings(shopId: string) {
  return prisma.appSettings.findUnique({ where: { shopId } });
}

export async function saveAppSettings(shopId: string, input: z.infer<typeof appSettingsSchema>) {
  return prisma.appSettings.upsert({
    where: { shopId },
    create: { ...input, shopId },
    update: { ...input },
  });
}

/**
 * Updates selected app settings fields without overwriting unset fields.
 */
export async function updateAppSettings(
  shopId: string,
  input: Partial<z.infer<typeof appSettingsSchema>>,
) {
  const existing = await getAppSettings(shopId);
  const defaults = appSettingsSchema.parse({});
  const merged: z.infer<typeof appSettingsSchema> = {
    ...defaults,
    ...(existing
      ? {
          showProductCount: existing.showProductCount,
          showActiveFilters: existing.showActiveFilters,
          productGridSelector: existing.productGridSelector,
          resultsSectionSelector: existing.resultsSectionSelector,
          paginationMode: (existing.paginationMode as "infinite" | "pagination") || "infinite",
          mobileDrawerPosition: (existing.mobileDrawerPosition as "right" | "left") || "right",
          mobileTriggerText: existing.mobileTriggerText,
          mobileButtonVariant: (existing.mobileButtonVariant as "outline" | "solid") || "outline",
          mobileShowProductCount: existing.mobileShowProductCount,
        }
      : {}),
    ...input,
  };

  return prisma.appSettings.upsert({
    where: { shopId },
    create: { ...merged, shopId },
    update: { ...merged },
  });
}

/**
 * Builds the complete StorefrontConfig used to hydrate the Theme App
 * Extension. Combines filter config, appearance, and settings into the
 * shape the storefront reads. Never includes secrets or tokens.
 */
export async function getStorefrontConfig(shopId: string): Promise<StorefrontConfig> {
  const [filters, appearance, settings] = await Promise.all([
    listFilters(shopId),
    getAppearance(shopId),
    getAppSettings(shopId),
  ]);

  return {
    filters: filters.map((f: Awaited<ReturnType<typeof listFilters>>[number]) => ({
      id: f.id,
      sourceKey: f.sourceKey,
      label: f.label,
      enabled: f.enabled,
      position: f.position,
      presentation: f.presentation as FilterPresentation,
      searchable: f.searchable,
      showCounts: f.showCounts,
      initialVisibleCount: f.initialVisibleCount,
      showMore: f.showMore,
      expandedDesktop: f.expandedDesktop,
      expandedMobile: f.expandedMobile,
      sourceType: inferSourceType(f.sourceKey),
    })),
    appearance: {
      sidebarWidth: appearance?.sidebarWidth ?? 260,
      sidebarWidthMin: appearance?.sidebarWidthMin ?? 220,
      sidebarWidthMax: appearance?.sidebarWidthMax ?? 340,
      headingSize: appearance?.headingSize ?? "16px",
      optionFontSize: appearance?.optionFontSize ?? "14px",
      showDivider: appearance?.showDivider ?? true,
      dividerStrength: appearance?.dividerStrength ?? "1px",
      checkboxRadius: appearance?.checkboxRadius ?? "4px",
      checkboxSize: appearance?.checkboxSize ?? "18px",
      accentColor: appearance?.accentColor ?? "#032443",
      textColor: appearance?.textColor ?? "#1F2937",
      mutedTextColor: appearance?.mutedTextColor ?? "#6B7280",
      borderColor: appearance?.borderColor ?? "#E5E7EB",
      selectedColor: appearance?.selectedColor ?? "#032443",
      panelBackground: appearance?.panelBackground ?? "#FFFFFF",
      panelRadius: appearance?.panelRadius ?? "8px",
      spacing: appearance?.spacing ?? "16px",
      stickyDesktop: appearance?.stickyDesktop ?? true,
      stickyTopOffset: appearance?.stickyTopOffset ?? 80,
      mobileBreakpoint: appearance?.mobileBreakpoint ?? 990,
    },
    settings: {
      showProductCount: settings?.showProductCount ?? true,
      showActiveFilters: settings?.showActiveFilters ?? true,
      productGridSelector: settings?.productGridSelector ?? "",
      resultsSectionSelector: settings?.resultsSectionSelector ?? "",
      paginationMode: (settings?.paginationMode as "infinite" | "pagination") ?? "infinite",
      mobileDrawerPosition: (settings?.mobileDrawerPosition as "right" | "left") ?? "right",
      mobileTriggerText: settings?.mobileTriggerText ?? "Filters",
      mobileButtonVariant: (settings?.mobileButtonVariant as "outline" | "solid") ?? "outline",
      mobileShowProductCount: settings?.mobileShowProductCount ?? true,
    },
  };
}

function inferSourceType(sourceKey: string): "vendor" | "product_type" | "price" | "availability" | "category" | "option" | "metafield" | "tag" {
  if (sourceKey === "filter.p.vendor") return "vendor";
  if (sourceKey === "filter.p.product_type") return "product_type";
  if (sourceKey.startsWith("filter.v.price")) return "price";
  if (sourceKey === "filter.v.availability") return "availability";
  if (sourceKey.startsWith("filter.p.category")) return "category";
  if (sourceKey.startsWith("filter.v.option.")) return "option";
  if (sourceKey.startsWith("filter.p.m.")) return "metafield";
  if (sourceKey.startsWith("filter.p.tag")) return "tag";
  return "metafield";
}
