import * as React from "react";
export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "base" | "raised" | "sunken" | "accent" | "inverse" | "none";
  border?: boolean;
  /** Radius token suffix: table | input | cta | panel | modal | pill. */
  radius?: "none" | "table" | "input" | "cta" | "panel" | "modal" | "pill";
  /** Full-bleed band — squares the corners. */
  bleed?: boolean;
  grid?: boolean;
  /** Sage dot field instead of the ortho grid. */
  dots?: boolean;
  padding?: number | string;
}
export declare function Surface(props: SurfaceProps): JSX.Element;
