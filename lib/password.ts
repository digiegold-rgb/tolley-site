import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hashedValue] = storedHash.split(":");

  if (!salt || !hashedValue) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const hashedBuffer = Buffer.from(hashedValue, "hex");

  if (hashedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(hashedBuffer, derivedKey);
}
