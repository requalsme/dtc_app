import * as React from "react";
export interface MetricTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  /** accent = pale mint; alert = muted plum, for anything awaiting action. */
  tone?: "default" | "accent" | "alert";
  icon?: React.ReactNode;
}
export declare function MetricTile(props: MetricTileProps): JSX.Element;
