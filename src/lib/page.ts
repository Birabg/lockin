/** Page number from a query string. Anything odd means page 1. */
export function parsePage(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}
