// Map ISO currency codes to display symbols.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
};

export function currencySymbol(code?: string | null): string {
  if (!code) return "$";
  const upper = code.toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? `${upper} `;
}

export function formatPrice(code: string | null | undefined, amount: number | string): string {
  const symbol = currencySymbol(code);
  // For symbols like "USD " we already have a trailing space; otherwise prepend directly.
  return symbol.endsWith(" ") ? `${symbol}${amount}` : `${symbol}${amount}`;
}
