export type FilterPresentation =
  | "checkbox-list"
  | "radio-list"
  | "swatches"
  | "price-range"
  | "boolean"
  | "image"
  | "pills";

export type FilterSourceType =
  | "vendor"
  | "product_type"
  | "price"
  | "availability"
  | "category"
  | "option"
  | "metafield"
  | "tag";

export interface FilterGroupConfig {
  id: string;
  sourceKey: string;
  label: string;
  enabled: boolean;
  position: number;
  presentation: FilterPresentation;
  searchable: boolean;
  showCounts: boolean;
  initialVisibleCount: number;
  showMore: boolean;
  expandedDesktop: boolean;
  expandedMobile: boolean;
  sourceType: FilterSourceType;
}

export interface AppearanceConfig {
  sidebarWidth: number;
  sidebarWidthMin: number;
  sidebarWidthMax: number;
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
}

export interface AppSettingsConfig {
  showProductCount: boolean;
  showActiveFilters: boolean;
  productGridSelector: string;
  resultsSectionSelector: string;
  paginationMode: "infinite" | "pagination";
  mobileDrawerPosition: "right" | "left";
  mobileTriggerText: string;
  mobileButtonVariant: "outline" | "solid";
  mobileShowProductCount: boolean;
}

export interface StorefrontConfig {
  filters: FilterGroupConfig[];
  appearance: AppearanceConfig;
  settings: AppSettingsConfig;
}
