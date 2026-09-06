import * as React from "react";
export interface RecordRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Catalog index, zero-padded — the record's identity. */
  index?: number;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned mono metadata — dates, counts, times. */
  meta?: React.ReactNode;
  stamp?: React.ReactNode;
  actions?: React.ReactNode;
  selected?: boolean;
  accentEdge?: boolean;
}
export declare function RecordRow(props: RecordRowProps): JSX.Element;
