import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const HOST = process.env.CONNECTOR_HOST || "127.0.0.1";
const PORT = Number(process.env.CONNECTOR_PORT || 8787);
const BRIDGE_BASE_URL = (process.env.BRIDGE_BASE_URL || "").replace(/\/$/, "");
const WEBSITE_SECRET = process.env.WEBSITE_TO_CONNECTOR_SECRET || "";
const BRIDGE_SECRET = process.env.CONNECTOR_TO_BRIDGE_SECRET || "";
const CLOCK_SKEW_SECONDS = Number(process.env.BRIDGE_MAX_SKEW_SECONDS || 60);
const NONCE_TTL_MS = Number(process.env.BRIDGE_NONCE_TTL_MS || 5 * 60 * 1000);
const AUDIT_PATH =
  process.env.OPENCLAW_AUDIT_PATH ||
  path.join(os.homedir(), ".openclaw", "audit", "admin-actions.jsonl");

const nonceCache = new Map();

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createSignature({ secret, timestamp, nonce, method, pathWithQuery, bodyHash }) {
  const payload = [
    timestamp,
    nonce,
    method.toUpperCase(),
    pathWithQuery,
    bodyHash,
  ].join(".");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function signaturesMatch(expected, provided) {
  const a = String(expected || "").trim().toLowerCase();
  const b = String(provided || "").trim().toLowerCase();
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function pruneNonceCache() {
  const now = Date.now();
  for (const [nonce, expiresAt] of nonceCache.entries()) {
    if (expiresAt <= now) {
      nonceCache.delete(nonce);
    }
  }
}

function verifyIncomingSignature({ req, pathWithQuery, bodyBytes }) {
  if (!WEBSITE_SECRET) {
    return { ok: false, status: 503, error: "WEBSITE_TO_CONNECTOR_SECRET not set" };
  }

  const timestamp = req.headers["x-bridge-timestamp"];
  const nonce = req.headers["x-bridge-nonce"];
  const signature = req.headers["x-bridge-signature"];

  if (
    typeof timestamp !== "string" ||
    typeof nonce !== "string" ||
    typeof signature !== "string"
  ) {
    return { ok: false, status: 401, error: "Missing bridge auth headers" };
  }

  const timestampSec = Number(timestamp);
  if (!Number.isFinite(timestampSec)) {
    return { ok: false, status: 401, error: "Invalid timestamp" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > CLOCK_SKEW_SECONDS) {
    return { ok: false, status: 401, error: "Timestamp outside allowed skew" };
  }

  pruneNonceCache();
  if (nonceCache.has(nonce)) {
    return { ok: false, status: 401, error: "Nonce replay detected" };
  }

  const expectedSignature = createSignature({
    secret: WEBSITE_SECRET,
    timestamp,
    nonce,
    method: req.method || "GET",
    pathWithQuery,
    bodyHash: sha256Hex(bodyBytes),
  });

  if (!signaturesMatch(expectedSignature, signature)) {
    return { ok: false, status: 401, error: "Signature mismatch" };
  }

  nonceCache.set(nonce, Date.now() + NONCE_TTL_MS);
  return { ok: true };
}

function buildBridgeSignatureHeaders({ method, pathWithQuery, bodyBytes }) {
  if (!BRIDGE_SECRET) {
    throw new Error("CONNECTOR_TO_BRIDGE_SECRET not set");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const signature = createSignature({
    secret: BRIDGE_SECRET,
    timestamp,
    nonce,
    method,
    pathWithQuery,
    bodyHash: sha256Hex(bodyBytes),
  });

  return {
    "x-bridge-timestamp": timestamp,
    "x-bridge-nonce": nonce,
    "x-bridge-signature": signature,
  };
}

async function writeAuditLine(entry) {
  const auditDir = path.dirname(AUDIT_PATH);
  await mkdir(auditDir, { recursive: true });
  await appendFile(AUDIT_PATH, `${JSON.stringify(entry)}\n`, "utf8");
}

function getTargetHints(pathWithQuery) {
  const parts = pathWithQuery.split("?")[0].split("/").filter(Boolean);
  const hints = {};

  const agentIndex = parts.indexOf("agents");
  if (agentIndex >= 0 && parts[agentIndex + 1]) {
    hints.agentId = parts[agentIndex + 1];
  }

  const bindingIndex = parts.indexOf("bindings");
  if (bindingIndex >= 0 && parts[bindingIndex + 1]) {
    hints.bindingId = parts[bindingIndex + 1];
  }

  return hints;
}

function isMutatingMethod(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function filterForwardedHeaders(headers) {
  const result = {};
  const allow = ["content-type", "cache-control", "x-request-id", "x-bridge-request-id"];

  for (const name of allow) {
    const value = headers.get(name);
    if (value) {
      result[name] = value;
    }
  }

  return result;
}

async function handleProxy(req, res, parsedUrl, bodyBytes) {
  if (!BRIDGE_BASE_URL) {
    sendJson(res, 503, { error: "BRIDGE_BASE_URL not configured" });
    return;
  }

  const pathWithQuery = `${parsedUrl.pathname}${parsedUrl.search}`;
  const verification = verifyIncomingSignature({
    req,
    pathWithQuery,
    bodyBytes,
  });
  if (!verification.ok) {
    sendJson(res, verification.status, { error: verification.error });
    return;
  }

  const adminEmail = String(req.headers["x-admin-email"] || "unknown");
  const method = (req.method || "GET").toUpperCase();
  const bridgeHeaders = buildBridgeSignatureHeaders({
    method,
    pathWithQuery,
    bodyBytes,
  });

  const forwardHeaders = {
    ...bridgeHeaders,
    "x-admin-email": adminEmail,
    "x-admin-user-id": String(req.headers["x-admin-user-id"] || ""),
  };
  if (req.headers["content-type"]) {
    forwardHeaders["content-type"] = String(req.headers["content-type"]);
  }

  const bridgeUrl = `${BRIDGE_BASE_URL}${pathWithQuery}`;
  const startedAt = Date.now();

  let upstream;
  try {
    upstream = await fetch(bridgeUrl, {
      method,
      headers: forwardHeaders,
      body: bodyBytes.length ? bodyBytes : undefined,
      cache: "no-store",
    });
  } catch (error) {
    sendJson(res, 503, { error: "Bridge unavailable", details: String(error) });
    return;
  }

  const responseBuffer = Buffer.from(await upstream.arrayBuffer());
  const responseHeaders = filterForwardedHeaders(upstream.headers);
  res.writeHead(upstream.status, responseHeaders);
  res.end(responseBuffer);

  if (isMutatingMethod(method)) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      adminEmail,
      action: `${method} ${parsedUrl.pathname}`,
      path: pathWithQuery,
      target: getTargetHints(pathWithQuery),
      diffSummary: bodyBytes.length
        ? `payload_sha256=${sha256Hex(bodyBytes)} bytes=${bodyBytes.length}`
        : "no_body",
      status: upstream.status,
      durationMs: Date.now() - startedAt,
    };
    try {
      await writeAuditLine(auditEntry);
    } catch (error) {
      console.error("audit write failed", error);
    }
  }
}

async function requestHandler(req, res) {
  const baseUrl = `http://${req.headers.host || "localhost"}`;
  const parsedUrl = new URL(req.url || "/", baseUrl);

  if (req.method === "GET" && parsedUrl.pathname === "/connector/health") {
    sendJson(res, 200, {
      ok: true,
      bridgeBaseUrl: BRIDGE_BASE_URL || null,
      host: HOST,
      port: PORT,
      nonceCacheSize: nonceCache.size,
      now: new Date().toISOString(),
    });
    return;
  }

  const allowed = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
  const method = (req.method || "GET").toUpperCase();
  if (!allowed.has(method)) {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const bodyBytes = method === "GET" ? Buffer.alloc(0) : await readBody(req);
  await handleProxy(req, res, parsedUrl, bodyBytes);
}

const server = http.createServer((req, res) => {
  requestHandler(req, res).catch((error) => {
    console.error("connector fatal error", error);
    sendJson(res, 500, { error: "Internal connector error" });
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `[connector] listening on http://${HOST}:${PORT} -> bridge=${BRIDGE_BASE_URL || "unset"}`,
  );
});
