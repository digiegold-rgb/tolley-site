import { publicOperators } from "@/lib/laundry/store";
import { handle } from "@/lib/laundry/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(async () => ({
    operators: await publicOperators(
      new URL(req.url).searchParams.get("q")?.slice(0, 100) || "",
    ),
  }));
}
