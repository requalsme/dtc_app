import * as React from "react";
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Space-token step (1,2,3,4,5,6,8,10,12,16,20,24) or a CSS length. */
  gap?: number | string;
  align?: React.CSSProperties["alignItems"];
  /** Separate children with hairlines instead of gap. */
  divide?: boolean;
}
export declare function Stack(props: StackProps): JSX.Element;
