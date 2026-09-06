import * as React from "react";
export interface VideoModuleProps extends React.HTMLAttributes<HTMLDivElement> {
  index?: number;
  title: string;
  /** Mono duration, e.g. "12 min". */
  duration?: string;
  /** 0-100 watched percentage. */
  progress?: number;
  locked?: boolean;
  complete?: boolean;
}
export declare function VideoModule(props: VideoModuleProps): JSX.Element;
