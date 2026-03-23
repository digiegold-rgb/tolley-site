import { NextResponse } from "next/server";
import { auth } from "@/auth";

const LEDGER_URL = "http://127.0.0.1:8920";
const BEARER = process.env.LEDGER_BEARER_TOKEN || "b9a081c92e68b3f874636bf6c687754edb130136312d012627bdbd61d6f584ed";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resp = await fetch(`${LEDGER_URL}/pay/link-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEARER}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invoiceNumber: `driver-${session.user.id}` }),
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
