import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { getHealth, getRecent, logMediaWorkerFailure } from "@/lib/media-worker";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [recent, health] = await Promise.all([getRecent(), getHealth()]);
    return NextResponse.json({ ...recent, worker: health });
  } catch (err) {
    const { error } = logMediaWorkerFailure("recent", err);
    return NextResponse.json({ error }, { status: 502 });
  }
}
