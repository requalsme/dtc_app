import * as React from "react";
export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements;
  /** Ladder step: display 56/60 · title 36/42 · section 24/30 · card 17/22 · body 15/23 · support 13/18 · meta 11/16 tracked mono · figure (serif, 40px) · numeral (serif, 13px — timestamps and table figures). */
  role?: "display" | "title" | "section" | "card" | "body" | "support" | "meta" | "figure" | "numeral";
  color?: "primary" | "secondary" | "quiet" | "brand" | "inverse" | "success" | "warning" | "danger";
  /** Clamp to the 58ch reading measure. */
  measure?: boolean;
  tabular?: boolean;
}
export declare function Text(props: TextProps): JSX.Element;
