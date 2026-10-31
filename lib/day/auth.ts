import "server-only";
import { secretEquals } from "@/lib/secret-compare";

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Vary": "Cookie, Authorization",
};
export function hasBearer(request: Request, secret: string | undefined) {
  const header = request.headers.get("authorization");
  return Boolean(secret && header?.startsWith("Bearer ") && secretEquals(header.slice(7), secret));
}
export function sameOrigin(request: Request) {
  // Browser refresh is same-origin JSON only; Siri tokens never authorize refresh.
  return request.headers.get("origin") === new URL(request.url).origin
    && request.headers.get("content-type")?.split(";")[0].trim() === "application/json";
}
