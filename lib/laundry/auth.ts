import { auth } from "@/auth";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { requireThat } from "./validation";
export type Actor = { id: string; email: string; admin: boolean };
export async function actor(): Promise<Actor> {
  const s = await auth();
  requireThat(
    s?.user?.id && s.user.email && !s.impersonatedBy && !s.mfaRequired,
    "Sign in to continue.",
    401,
  );
  return {
    id: s.user.id,
    email: s.user.email,
    admin: isVaterAdminEmail(s.user.email),
  };
}
