import type { ViewFilter, ViewSchema } from "./types";

interface ApplyCtx {
  /** Current user id — used to resolve "me" sentinel for user fields */
  userId?: string | null;
  /** Optional accessor map: how to read a field from the row */
  accessors?: Record<string, (row: any) => any>;
}

const isEmpty = (v: any) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

function get(row: any, field: string, ctx: ApplyCtx) {
  if (ctx.accessors?.[field]) return ctx.accessors[field](row);
  return row?.[field];
}

function resolveValue(v: any, ctx: ApplyCtx): any {
  if (v === "@me") return ctx.userId ?? null;
  if (Array.isArray(v)) return v.map((x) => (x === "@me" ? ctx.userId : x));
  return v;
}

export function rowMatchesFilter(row: any, f: ViewFilter, ctx: ApplyCtx): boolean {
  const a = get(row, f.field, ctx);
  const v = resolveValue(f.value, ctx);
  switch (f.op) {
    case "is":
    case "eq":
      return a == v;
    case "is_not":
      return a != v;
    case "in":
      return Array.isArray(v) && v.includes(a);
    case "not_in":
      return Array.isArray(v) && !v.includes(a);
    case "contains":
      return typeof a === "string" && typeof v === "string" && a.toLowerCase().includes(v.toLowerCase());
    case "not_contains":
      return !(typeof a === "string" && typeof v === "string" && a.toLowerCase().includes(v.toLowerCase()));
    case "is_empty":
      return isEmpty(a);
    case "is_not_empty":
      return !isEmpty(a);
    case "is_true":
      return a === true;
    case "is_false":
      return a === false;
    case "gt":
      return Number(a) > Number(v);
    case "lt":
      return Number(a) < Number(v);
    case "before":
      return a && new Date(a).getTime() < new Date(v).getTime();
    case "after":
      return a && new Date(a).getTime() > new Date(v).getTime();
    case "between": {
      if (!a || !Array.isArray(v) || v.length !== 2) return false;
      const t = new Date(a).getTime();
      return t >= new Date(v[0]).getTime() && t <= new Date(v[1]).getTime();
    }
    default:
      return true;
  }
}

export function applyFilters<T = any>(
  rows: T[],
  filters: ViewFilter[] | undefined,
  ctx: ApplyCtx = {}
): T[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((r) => filters.every((f) => rowMatchesFilter(r, f, ctx)));
}

export function applySort<T = any>(
  rows: T[],
  sort: { field: string; dir: "asc" | "desc" } | null | undefined,
  ctx: ApplyCtx = {}
): T[] {
  if (!sort?.field) return rows;
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = get(a, sort.field, ctx);
    const bv = get(b, sort.field, ctx);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

export function groupRows<T = any>(
  rows: T[],
  groupBy: string | null | undefined,
  ctx: ApplyCtx = {}
): { key: string; rows: T[] }[] | null {
  if (!groupBy) return null;
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(get(r, groupBy, ctx) ?? "—");
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return Array.from(map.entries()).map(([key, rs]) => ({ key, rows: rs }));
}
