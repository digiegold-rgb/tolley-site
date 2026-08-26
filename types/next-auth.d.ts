import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    issuedAt?: string;
    /**
     * Set ONLY while an admin is running a "view as user" support session
     * (lib/vater/acting-as.ts): the real admin's email, while session.user
     * has already been swapped to the impersonated customer. Absent for every
     * ordinary session. Writes are blocked site-wide while it is set.
     */
    impersonatedBy?: string | null;
    /**
     * Set while the login is inside one of its Jelly Studio workspace TABS
     * (lib/vater/workspaces.ts): `id` is the hidden User the request acts as
     * (== session.user.id), `rootUserId` the real login. Absent on the
     * primary tab and for every non-studio session. session.user.email is
     * always the real login's.
     */
    workspace?: { id: string; rootUserId: string };
    user?: DefaultSession["user"] & {
      id: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** User.sessionVersion this token was minted against (revocation). */
    sv?: number;
    /** Unix seconds of the last sessionVersion re-check. */
    svAt?: number;
  }
}
