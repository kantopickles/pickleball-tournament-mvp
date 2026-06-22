import { createHash, randomUUID } from "crypto";

export function hashPin(pin: string) {
  return createHash("sha256").update(pin.trim()).digest("hex");
}

export function isFourDigitPin(pin: string) {
  return /^\d{4}$/.test(pin.trim());
}

export function recoverFourDigitPin(hash: string | null | undefined) {
  if (!hash) return null;

  for (let number = 0; number <= 9999; number += 1) {
    const pin = String(number).padStart(4, "0");
    if (hashPin(pin) === hash) return pin;
  }

  return null;
}

export function createSlug() {
  return randomUUID().split("-")[0];
}
