import * as React from "react";
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** One reassuring line, then the single action to take. */
  description?: string;
  action?: React.ReactNode;
  /** Leaf mark watermark at 7% opacity, bottom-right. */
  watermark?: boolean;
  basePath?: string;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
