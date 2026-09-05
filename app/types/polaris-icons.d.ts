declare module "@shopify/polaris-icons" {
  import type { FunctionComponent, SVGProps } from "react";
  export type IconSource = FunctionComponent<SVGProps<SVGSVGElement>>;
  export const HomeIcon: IconSource;
  export const FiltersIcon: IconSource;
  export const PaintBrushIcon: IconSource;
  export const MobileIcon: IconSource;
  export const BoltIcon: IconSource;
  export const SettingsIcon: IconSource;
  export const NoteIcon: IconSource;
  const icons: Record<string, IconSource>;
  export default icons;
}
