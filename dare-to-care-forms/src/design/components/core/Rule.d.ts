import * as React from "react";
export interface RuleProps extends React.HTMLAttributes<HTMLDivElement> {
  vertical?: boolean;
  strength?: "hair" | "subtle" | "default" | "strong" | "brand";
  /** Thicker rule in brand green. */
  accent?: boolean;
  length?: number | string;
  /** Vertical margin on a horizontal rule. */
  inset?: number | string;
  /** Diamond intersection mark at the midpoint — a section break. Horizontal only; use once or twice per screen. */
  mark?: boolean;
}
export declare function Rule(props: RuleProps): JSX.Element;
