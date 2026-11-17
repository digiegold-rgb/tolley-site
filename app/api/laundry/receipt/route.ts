import { prisma } from "@/lib/prisma";
import { verifyReceipt } from "@/lib/laundry/store";
import { reply } from "@/lib/laundry/http";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams,
    id = q.get("id") || "",
    token = q.get("token") || "";
  if (!verifyReceipt(id, token)) return reply({ error: "Not found" }, 404);
  const lead = await prisma.laundryLead.findUnique({ where: { id } });
  if (!lead?.agreementText) return reply({ error: "No signed agreement" }, 404);
  return new Response(
    `${lead.agreementText}\n\nSigned by: ${lead.signedName}\nSigned at: ${lead.signedAt?.toISOString()}\nRequest: ${lead.id}\nDocument SHA-256: ${lead.agreementHash}\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=rental-agreement.txt",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
