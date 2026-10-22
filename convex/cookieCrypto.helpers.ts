/**
 * At-rest encryption for stored Canvas session cookies.
 *
 * AES-256-GCM via Web Crypto (available in Convex actions). The key is
 * CANVAS_COOKIE_KEY: 32 random bytes, base64 — generate with
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * and set it on BOTH deployments (`npx convex env set ...` and `... --prod`).
 *
 * The owning userId is bound as additional authenticated data, so a ciphertext
 * copied onto another user's row fails to decrypt.
 *
 * Stored format: `enc:v1:<base64 iv>:<base64 ciphertext>`. Values without the
 * prefix are legacy plaintext — readers accept them until the one-shot
 * migration (canvasCookieMigration.encryptLegacyCookies) has run.
 */

const PREFIX = "enc:v1:";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadKey(): Promise<CryptoKey> {
  const raw = process.env.CANVAS_COOKIE_KEY;
  if (!raw) throw new Error("CANVAS_COOKIE_KEY is not configured");
  const keyBytes = fromBase64(raw);
  if (keyBytes.length !== 32) throw new Error("CANVAS_COOKIE_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export function isEncryptedCookies(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export async function encryptCookies(plaintext: string, userId: string): Promise<string> {
  const key = await loadKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(userId) },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

/** Decrypts an `enc:v1:` value; returns legacy plaintext unchanged. */
export async function decryptCookies(stored: string, userId: string): Promise<string> {
  if (!isEncryptedCookies(stored)) return stored;
  const [ivB64, ctB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !ctB64) throw new Error("Malformed encrypted cookie value");
  const key = await loadKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivB64), additionalData: new TextEncoder().encode(userId) },
    key,
    fromBase64(ctB64)
  );
  return new TextDecoder().decode(plaintext);
}
