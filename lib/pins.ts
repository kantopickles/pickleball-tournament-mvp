import { createHash, randomUUID } from "crypto";

export function hashPin(pin: string) {
  return createHash("sha256").update(pin.trim()).digest("hex");
}

export function createSlug() {
  return randomUUID().split("-")[0];
}
