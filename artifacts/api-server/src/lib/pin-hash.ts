import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;
const PREFIX = "scrypt";

/**
 * Hash a PIN using scrypt with a random salt.
 * Returns a self-describing string: "scrypt:salt_hex:hash_hex"
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LEN, SCRYPT_PARAMS);
  return `${PREFIX}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a PIN against a stored scrypt hash. Constant-time comparison.
 * Also accepts legacy plaintext PINs (for backward-compatible migration).
 */
export function verifyPin(pin: string, stored: string): boolean {
  if (!stored) return false;

  // Scrypt hash format
  if (stored.startsWith(`${PREFIX}:`)) {
    try {
      const parts = stored.split(":");
      if (parts.length !== 3) return false;
      const salt = Buffer.from(parts[1], "hex");
      const expected = Buffer.from(parts[2], "hex");
      const actual = scryptSync(pin, salt, KEY_LEN, SCRYPT_PARAMS);
      if (actual.length !== expected.length) return false;
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  // Legacy: plaintext PIN (4-digit string). Constant-time compare.
  try {
    const a = Buffer.from(pin);
    const b = Buffer.from(stored);
    if (a.length !== b.length) {
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Returns true if the stored value is a scrypt hash (not legacy plaintext) */
export function isHashed(stored: string): boolean {
  return stored.startsWith(`${PREFIX}:`);
}
