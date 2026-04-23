import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a snake_case, kebab-case, or lowercase token (e.g. "on_hold", "service_request",
 * "high") into a human-readable Title Case label (e.g. "On Hold", "Service Request", "High").
 */
export function formatLabel(value?: string | null): string {
  if (!value) return "";
  return String(value)
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
