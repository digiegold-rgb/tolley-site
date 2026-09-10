import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { notFound, redirect } from "next/navigation";

export async function ownerToolSession() {
  const session = await auth();
  return session?.user?.id && !session.mfaRequired && !session.impersonatedBy && isAdminEmail(session.user.email) ? session : null;
}

export async function validateOwnerTool(request?: Request) {
  if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("origin") !== new URL(request.url).origin) return false;
  return Boolean(await ownerToolSession());
}

export async function requireOwnerTool(path: string) {
  const session = await auth();
  const callback = encodeURIComponent(path);
  if (session?.mfaRequired) redirect(`/login/mfa-challenge?callbackUrl=${callback}`);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${callback}`);
  if (session.impersonatedBy || !isAdminEmail(session.user.email)) notFound();
  return session;
}
