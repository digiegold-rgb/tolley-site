import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGbp } from "@/lib/reviews/gbps";

/**
 * GET /go/r/[code]
 *
 * Resolves a review-request short code to the corresponding GBP review URL,
 * stamps the click timestamp, and 302-redirects. Unknown codes redirect home.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const reviewReq = await prisma.reviewRequest.findUnique({
    where: { shortCode: code },
    select: { id: true, gbpKey: true, status: true, clickedAt: true },
  });

  if (!reviewReq) {
    return NextResponse.redirect("https://www.tolley.io/", 302);
  }

  const gbp = getGbp(reviewReq.gbpKey);
  if (!gbp || !gbp.reviewUrl) {
    return NextResponse.redirect("https://www.tolley.io/", 302);
  }

  // Record click — only stamp the first click so we don't overwrite
  // analytics on repeated taps.
  if (!reviewReq.clickedAt) {
    await prisma.reviewRequest
      .update({
        where: { id: reviewReq.id },
        data: {
          clickedAt: new Date(),
          status:
            reviewReq.status === "queued" ? reviewReq.status : "clicked",
        },
      })
      .catch(() => {});
  }

  return NextResponse.redirect(gbp.reviewUrl, 302);
}
