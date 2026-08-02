import { randomBytes } from "crypto";

/**
 * Generates a cryptographically random URL-safe token (16 bytes = 22 base64url chars)
 */
export function generateToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Generates a random 4-digit PIN
 */
export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
