import * as React from "react";
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl" | number;

  /** Tints the block with a role colour: admin | office | caregiver | new-hire | client. */
  role?: "admin" | "office" | "caregiver" | "new-hire" | "client";
  markFallback?: boolean;
  basePath?: string;
}
export declare function Avatar(props: AvatarProps): JSX.Element;
