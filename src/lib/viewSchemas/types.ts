export type FieldType =
  | "text"
  | "enum"
  | "multiEnum"
  | "user"
  | "ref"
  | "bool"
  | "date"
  | "number";

export type FilterOp =
  | "is"
  | "is_not"
  | "in"
  | "not_in"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "before"
  | "after"
  | "between"
  | "gt"
  | "lt"
  | "eq"
  | "is_true"
  | "is_false";

export interface FieldOption {
  value: string;
  label: string;
}

export interface ViewField {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  filterable?: boolean; // default true
  sortable?: boolean; // default true
  groupable?: boolean; // default false
  /** Default visible column */
  defaultVisible?: boolean;
  /** Operators allowed; sensible default by type if omitted */
  operators?: FilterOp[];
  /** When type === "user", values are user ids; "me" sentinel resolved at apply time */
  /** When type === "ref", you can pass a loader to populate options dynamically */
  loadOptions?: () => Promise<FieldOption[]>;
}

export interface ViewSchema {
  scope: string;
  fields: ViewField[];
  /** Available layouts on this register */
  layouts?: ("table" | "kanban" | "calendar" | "list" | "board" | "gantt")[];
}

export interface ViewFilter {
  id: string;
  field: string;
  op: FilterOp;
  value?: any;
}

export const DEFAULT_OPS_BY_TYPE: Record<FieldType, FilterOp[]> = {
  text: ["contains", "not_contains", "is", "is_not", "is_empty", "is_not_empty"],
  enum: ["is", "is_not", "in", "not_in", "is_empty", "is_not_empty"],
  multiEnum: ["in", "not_in", "is_empty", "is_not_empty"],
  user: ["is", "is_not", "in", "not_in", "is_empty", "is_not_empty"],
  ref: ["is", "is_not", "in", "not_in", "is_empty", "is_not_empty"],
  bool: ["is_true", "is_false"],
  date: ["before", "after", "between", "is_empty", "is_not_empty"],
  number: ["eq", "gt", "lt", "between", "is_empty", "is_not_empty"],
};

export const OP_LABELS: Record<FilterOp, string> = {
  is: "is",
  is_not: "is not",
  in: "is any of",
  not_in: "is none of",
  contains: "contains",
  not_contains: "does not contain",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  before: "before",
  after: "after",
  between: "between",
  gt: ">",
  lt: "<",
  eq: "=",
  is_true: "is true",
  is_false: "is false",
};
