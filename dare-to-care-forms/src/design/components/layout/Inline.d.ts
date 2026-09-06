import * as React from "react";
export interface InlineProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: number | string;
  align?: React.CSSProperties["alignItems"];
  justify?: React.CSSProperties["justifyContent"];
  wrap?: boolean;
}
export declare function Inline(props: InlineProps): JSX.Element;
