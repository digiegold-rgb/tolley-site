import { randomBytes, createHmac, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import QRCode from "qrcode";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

// Base32 alphabet (RFC 4648)
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str: string): Buffer {
  const cleaned = str.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// Generate TOTP code for a given secret and time
function generateTOTP(secret: string, time?: number): string {
  const key = base32Decode(secret);
  const epoch = Math.floor((time ?? Date.now() / 1000) / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(epoch, 4);

  const hmac = createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

// Generate a new TOTP secret + QR code
export async function generateTotpSecret(email: string) {
  const secret = base32Encode(randomBytes(20));
  const otpauthUrl = `otpauth://totp/Tolley.io:${encodeURIComponent(email)}?secret=${secret}&issuer=Tolley.io&algorithm=SHA1&digits=6&period=30`;
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, otpauthUrl, qrCodeDataUrl };
}

// Verify a TOTP code (allows +-1 time step window)
export function verifyTotpCode(secret: string, code: string): boolean {
  if (!code || code.length !== 6) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, now + i * 30) === code) {
      return true;
    }
  }
  return false;
}

// Generate backup codes
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(randomBytes(4).toString("hex"));
  }
  return codes;
}

// Hash a backup code for storage
export async function hashBackupCode(code: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(code, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

// Verify a backup code against a hash
export async function verifyBackupCode(
  code: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, hashedValue] = storedHash.split(":");
  if (!salt || !hashedValue) return false;

  const derivedKey = (await scrypt(code, salt, KEY_LENGTH)) as Buffer;
  const hashedBuffer = Buffer.from(hashedValue, "hex");

  if (hashedBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(hashedBuffer, derivedKey);
}
