export function createPayoutReference(prefix = "PAY") {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${prefix}-${yyyymmdd}-${suffix}`;
}
