/** The MCP Node transport's Hono adapter replaces these at construction time.
 * NextResponse subclasses the original Response, so preserve Next's constructors
 * when initializing that adapter in the same server process.
 */
export function preserveWebGlobals<T>(initialize: () => T): T {
  const request = Object.getOwnPropertyDescriptor(globalThis, "Request")!;
  const response = Object.getOwnPropertyDescriptor(globalThis, "Response")!;
  try {
    return initialize();
  } finally {
    Object.defineProperty(globalThis, "Request", request);
    Object.defineProperty(globalThis, "Response", response);
  }
}
