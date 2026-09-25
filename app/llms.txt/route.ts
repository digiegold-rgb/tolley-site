import { discoveryText } from "@/lib/discovery";
export function GET() {
  return new Response(discoveryText(false), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
