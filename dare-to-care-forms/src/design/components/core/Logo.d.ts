import * as React from "react";
export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** "lockup" = the artwork, min 180px wide. "bar" = mark + typeset wordmark, for top bars and mastheads too short for the lockup. "mark" = the leaf lobe alone. */
  variant?: "lockup" | "bar" | "mark";
  /** Use the white cut-out on deep green or forest grounds. */
  onDark?: boolean;
  /** Preferred sizing for the lockup. Clamped to a 180px minimum. */
  width?: number;
  /** Sizing for the mark (min 24px). On a lockup this is converted to a width via the 2:1 ratio and clamped — prefer `width`. */
  height?: number;
  /** Relative path from the consuming page to the design-system root. */
  basePath?: string;
}
export declare function Logo(props: LogoProps): JSX.Element;
