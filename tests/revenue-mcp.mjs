import assert from 'node:assert/strict';
import { createMcpHandler } from 'mcp-handler';
const NativeRequest = globalThis.Request;
const NativeResponse = globalThis.Response;
async function main() {
  const handler = createMcpHandler(() => {}, { serverInfo: { name: 'revenue-regression', version: '1.0' } }, { basePath: '/api' });
  assert.equal(globalThis.Request, NativeRequest, 'MCP initialization must preserve the native Request class');
  assert.equal(globalThis.Response, NativeResponse, 'MCP initialization must preserve the native Response class');
  const response = await handler(new Request('http://localhost/api/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'regression', version: '1.0' } } }),
  }));
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('revenue-regression'));
  assert.equal(globalThis.Response, NativeResponse, 'handling MCP requests must preserve framework Response identity');
  assert.ok(response instanceof NativeResponse);
  console.log('PASS: MCP initialization and request handling preserve native HTTP classes; protocol handshake succeeds.');
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
