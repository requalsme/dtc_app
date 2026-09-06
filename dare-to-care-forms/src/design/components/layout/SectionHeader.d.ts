import * as React from "react";
export interface SectionHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Catalog index — renders zero-padded before the label. */
  index?: number;
  /** Mono uppercase label, e.g. "Care management". */
  label: string;
  /** Optional display heading below the ruled label. */
  title?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  tone?: "default" | "inverse";
}
export declare function SectionHeader(props: SectionHeaderProps): JSX.Element;
