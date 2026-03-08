import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const SIGNATURE_ALGO = "sha256";

function asBuffer(value: Uint8Array | string) {
  return typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
}

export function sha256Hex(value: Uint8Array | string) {
  return createHash(SIGNATURE_ALGO).update(asBuffer(value)).digest("hex");
}

export function createBridgeSignature(args: {
  secret: string;
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  bodyHash: string;
}) {
  const payload = [
    args.timestamp,
    args.nonce,
    args.method.toUpperCase(),
    args.path,
    args.bodyHash,
  ].join(".");

  return createHmac(SIGNATURE_ALGO, args.secret).update(payload).digest("hex");
}

export function createBridgeAuthHeaders(args: {
  secret: string;
  method: string;
  path: string;
  bodyBytes?: Uint8Array;
}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const bodyHash = sha256Hex(args.bodyBytes || new Uint8Array());
  const signature = createBridgeSignature({
    secret: args.secret,
    timestamp,
    nonce,
    method: args.method,
    path: args.path,
    bodyHash,
  });

  return {
    "X-Bridge-Timestamp": timestamp,
    "X-Bridge-Nonce": nonce,
    "X-Bridge-Signature": signature,
  };
}

function normalizeHex(value: string) {
  return value.trim().toLowerCase();
}

export function signaturesMatch(expected: string, provided: string) {
  const normalizedExpected = normalizeHex(expected);
  const normalizedProvided = normalizeHex(provided);

  if (
    normalizedExpected.length !== normalizedProvided.length ||
    normalizedExpected.length === 0
  ) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(normalizedExpected, "hex"),
      Buffer.from(normalizedProvided, "hex"),
    );
  } catch {
    return false;
  }
}
