// All money is stored as integer cents. Floats never touch a stored amount.

export function formatCents(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

// "149.99" -> 14999. Rejects anything that isn't a plain non-negative amount with at most 2 decimals.
export function parseDollarsToCents(input: string): number {
  const trimmed = input.trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new Error(`Not a valid amount: "${input}"`);
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

// quantity may be fractional (1.5 hours); round the line total to the nearest cent.
export function lineTotalCents(quantity: number, unitPriceCents: number) {
  return Math.round(quantity * unitPriceCents);
}
