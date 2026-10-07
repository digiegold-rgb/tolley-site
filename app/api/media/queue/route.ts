import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { getJobs, logMediaWorkerFailure } from "@/lib/media-worker";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getJobs();
    return NextResponse.json(data);
  } catch (err) {
    const { error } = logMediaWorkerFailure("queue", err);
    return NextResponse.json({ error }, { status: 502 });
  }
}
