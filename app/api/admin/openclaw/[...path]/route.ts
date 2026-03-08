import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";
import { createBridgeAuthHeaders } from "@/lib/bridge-signing";

export const runtime = "nodejs";

const ROUTE_PREFIX = "/api/admin/openclaw";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function getConnectorBaseUrl() {
  const value = process.env.OPENCLAW_CONNECTOR_URL || "";
  return value.replace(/\/$/, "");
}

function normalizeRoutePath(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.startsWith(ROUTE_PREFIX)
    ? url.pathname.slice(ROUTE_PREFIX.length) || "/"
    : "/";
  return `${path}${url.search}`;
}

function pickResponseHeaders(headers: Headers) {
  const forwarded = new Headers();
  const allowed = [
    "content-type",
    "cache-control",
    "x-request-id",
    "x-bridge-request-id",
  ];

  for (const key of allowed) {
    const value = headers.get(key);
    if (value) {
      forwarded.set(key, value);
    }
  }

  return forwarded;
}

async function proxyRequest(request: Request) {
  if (!ALLOWED_METHODS.has(request.method.toUpperCase())) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const sessionResult = await requireAdminApiSession();
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const connectorBaseUrl = getConnectorBaseUrl();
  const bridgeSecret = process.env.OPENCLAW_CONNECTOR_SHARED_SECRET || "";

  if (!connectorBaseUrl || !bridgeSecret) {
    return NextResponse.json(
      { error: "Connector is not configured." },
      { status: 503 },
    );
  }

  const pathWithQuery = normalizeRoutePath(request);
  const forwardUrl = `${connectorBaseUrl}${pathWithQuery}`;
  const bodyBytes = ["GET", "HEAD"].includes(request.method.toUpperCase())
    ? new Uint8Array()
    : new Uint8Array(await request.arrayBuffer());

  const signatureHeaders = createBridgeAuthHeaders({
    secret: bridgeSecret,
    method: request.method,
    path: pathWithQuery,
    bodyBytes,
  });

  const forwardHeaders = new Headers();
  forwardHeaders.set("x-admin-email", sessionResult.session.email);
  forwardHeaders.set("x-admin-user-id", sessionResult.session.userId);
  forwardHeaders.set("x-forwarded-host", new URL(request.url).host);
  forwardHeaders.set("x-forwarded-proto", new URL(request.url).protocol.replace(":", ""));
  forwardHeaders.set("x-bridge-timestamp", signatureHeaders["X-Bridge-Timestamp"]);
  forwardHeaders.set("x-bridge-nonce", signatureHeaders["X-Bridge-Nonce"]);
  forwardHeaders.set("x-bridge-signature", signatureHeaders["X-Bridge-Signature"]);

  const incomingContentType = request.headers.get("content-type");
  if (incomingContentType) {
    forwardHeaders.set("content-type", incomingContentType);
  }

  try {
    const upstreamResponse = await fetch(forwardUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: bodyBytes.length ? bodyBytes : undefined,
      cache: "no-store",
    });

    const responseBytes = await upstreamResponse.arrayBuffer();
    return new Response(responseBytes, {
      status: upstreamResponse.status,
      headers: pickResponseHeaders(upstreamResponse.headers),
    });
  } catch (error) {
    console.error("admin openclaw proxy error", {
      pathWithQuery,
      error,
    });
    return NextResponse.json(
      { error: "OpenClaw connector unavailable." },
      { status: 503 },
    );
  }
}

export async function GET(request: Request) {
  return proxyRequest(request);
}

export async function POST(request: Request) {
  return proxyRequest(request);
}

export async function PUT(request: Request) {
  return proxyRequest(request);
}

export async function PATCH(request: Request) {
  return proxyRequest(request);
}

export async function DELETE(request: Request) {
  return proxyRequest(request);
}
