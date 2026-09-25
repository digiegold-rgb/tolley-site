import { discoveryText } from "@/lib/discovery";
export function GET() {
  return new Response(discoveryText(true), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
