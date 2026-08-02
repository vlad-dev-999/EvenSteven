import { randomBytes, randomInt } from "crypto";

/**
 * Generates a cryptographically random URL-safe token (16 bytes = 22 base64url chars)
 */
export function generateToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Generates a cryptographically secure random 4-digit PIN (1000–9999).
 */
export function generatePin(): string {
  // randomInt(min, max) is cryptographically secure (CSPRNG)
  return String(randomInt(1000, 10000));
}
