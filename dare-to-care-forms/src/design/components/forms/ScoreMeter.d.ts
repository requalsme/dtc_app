import * as React from "react";
export interface ScoreBand { upTo: number; label: string; tone: "success" | "warning" | "error" | "neutral" }
export interface ScoreMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  value?: number;
  max?: number;
  /** Ascending thresholds, e.g. [{upTo:5,label:"Low risk",tone:"success"}, …] */
  bands?: ScoreBand[];
}
export declare function ScoreMeter(props: ScoreMeterProps): JSX.Element;
