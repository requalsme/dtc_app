import * as React from "react";
export interface DocumentSlotProps extends React.HTMLAttributes<HTMLDivElement> {
  index?: number;
  name: string;
  /** Mirrors the application's file-checklist states. */
  state?: "filed" | "missing" | "expiring" | "expired";
  /** Mono detail — filed date, expiry date. */
  meta?: string;
  action?: React.ReactNode;
}
export declare function DocumentSlot(props: DocumentSlotProps): JSX.Element;
