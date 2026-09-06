import * as React from "react";
export interface MonoLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "muted" | "faint" | "brand" | "body" | "inverse";
  /** Extend a hairline rule from the label to the end of the container. */
  rule?: boolean;
  /** Zero-padded count set after the label. */
  count?: number;
  size?: "sm" | "lg";
}
export declare function MonoLabel(props: MonoLabelProps): JSX.Element;
