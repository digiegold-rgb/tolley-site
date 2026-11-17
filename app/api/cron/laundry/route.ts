import { secretEquals } from "@/lib/secret-compare";
import { runLaundryWorker } from "@/lib/laundry/worker";
import { reply, handle } from "@/lib/laundry/http";
export const maxDuration = 60;
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    !secretEquals(
      req.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return reply({ error: "Unauthorized" }, 401);
  return handle(runLaundryWorker);
}
