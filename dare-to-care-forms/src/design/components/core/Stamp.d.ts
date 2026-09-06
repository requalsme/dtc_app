import * as React from "react";
export interface StampProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Sets colour and the leaf's fill: success/brand solid, info/warning half, neutral/error outline. */
  tone?: "neutral" | "brand" | "success" | "warning" | "error" | "info";
  /** Fill the whole tag with its pale tone instead of tinting only the leaf cell. */
  solid?: boolean;
  /** Drop the leaf cell — plain word tag, for dense tables where the glyph would crowd. */
  leaf?: boolean;
  /** Override the leaf's fill level independently of tone: 0 outline, 0.5 half, 1 solid. */
  fill?: number;
  /** Makes the word cell a button that opens the record behind the status. */
  onClick?: React.MouseEventHandler;
  /** Makes the word cell a link to the record. */
  href?: string;
  /** Override the fixed 124px word cell — set once per table so a column stays aligned. */
  labelWidth?: number;
}
export declare function Stamp(props: StampProps): JSX.Element;
