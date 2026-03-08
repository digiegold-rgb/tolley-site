import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    issuedAt?: string;
    user?: DefaultSession["user"] & {
      id: string;
    };
  }
}
