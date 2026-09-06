import * as React from "react";
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** One of ICON_NAMES — the application's own 24x24 stroke set. */
  name: string;
  /** 16 inline with mono labels, 18 default, 20 in nav, 22 in dialog marks. */
  size?: number;
  strokeWidth?: number;
}
export declare function Icon(props: IconProps): JSX.Element;
export declare const ICON_NAMES: string[];
