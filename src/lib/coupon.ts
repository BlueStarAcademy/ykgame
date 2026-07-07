import { randomUUID } from "crypto";

export function createBarcodeCode() {
  return `YK-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}
