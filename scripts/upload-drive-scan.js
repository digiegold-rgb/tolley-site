#!/usr/bin/env node
/**
 * Upload crypto drive scan results to tolley.io API
 * Usage: node scripts/upload-drive-scan.js <results.json> [--url https://tolley.io]
 */

const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  url: process.env.TOLLEY_URL || "https://tolley.io",
  secret: process.env.SYNC_SECRET || "",
};

async function main() {
  const args = process.argv.slice(2);
  let jsonPath = null;
  let baseUrl = DEFAULTS.url;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      baseUrl = args[++i];
    } else if (!jsonPath) {
      jsonPath = args[i];
    }
  }

  if (!jsonPath) {
    console.error("Usage: upload-drive-scan.js <results.json> [--url https://tolley.io]");
    process.exit(1);
  }

  if (!DEFAULTS.secret) {
    console.error("Error: SYNC_SECRET env var is required");
    process.exit(1);
  }

  const fullPath = path.resolve(jsonPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

  console.log(`Uploading scan: ${data.label}`);
  console.log(`  Items: ${(data.items || []).length}`);
  console.log(`  Target: ${baseUrl}/api/crypto/drives`);

  const res = await fetch(`${baseUrl}/api/crypto/drives`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": DEFAULTS.secret,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Upload failed (${res.status}): ${text}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log(`\nSuccess! Scan ID: ${result.scan.id}`);
  console.log(`  Items stored: ${result.scan.items?.length || 0}`);

  // Summary by sensitivity
  const items = result.scan.items || [];
  const bySens = {};
  for (const item of items) {
    bySens[item.sensitivity] = (bySens[item.sensitivity] || 0) + 1;
  }
  for (const [sens, count] of Object.entries(bySens)) {
    console.log(`  ${sens}: ${count}`);
  }

  console.log(`\nView at: ${baseUrl}/crypto → Drives tab`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
