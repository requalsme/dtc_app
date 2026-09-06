import * as React from "react";
export interface TabItem { value: string; label: string; icon?: React.ReactNode; count?: number }
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  tabs: Array<TabItem | string>;
  value: string;
  onChange?: (value: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;
