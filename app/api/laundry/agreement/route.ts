import { agreementFor } from "@/lib/laundry/store";
import { handle } from "@/lib/laundry/http";
export async function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    return agreementFor(q.get("operator") || "", q.get("unit") || "set");
  });
}
