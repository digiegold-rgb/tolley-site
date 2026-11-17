import { after } from "next/server";
import { createLead, renterAction } from "@/lib/laundry/store";
import { handle, body } from "@/lib/laundry/http";
import { rateLimitByIp } from "@/lib/rate-limit";
import { runLaundryWorker } from "@/lib/laundry/worker";
export async function POST(req: Request) {
  const limited = await rateLimitByIp(req, "laundry:intake", 8, 600);
  if (limited) return limited;
  return handle(async () => {
    const b = await body(req);
    const result = b.action
      ? await renterAction(b.id, b.token, b.action, b)
      : await createLead(b);
    after(async () => {
      await runLaundryWorker();
    });
    return result;
  });
}
