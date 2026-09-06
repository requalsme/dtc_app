import * as React from "react";
export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "rail" | "sunken" | "accent" | "inverse" | "paper";
  padding?: number;
  /** Mono eyebrow in a hairline-ruled header rail. */
  label?: string;
  labelRight?: React.ReactNode;
  footer?: React.ReactNode;
  /** Sage hairline grid texture behind the content. */
  grid?: boolean;
  /** 3px primary-green bar down the leading edge — active or in-progress. */
  accentEdge?: boolean;
  /** Chamfer the top-right corner 15px — the filed-document corner. Records and summary panels only. */
  notch?: boolean;
  interactive?: boolean;
}
export declare function Panel(props: PanelProps): JSX.Element;
