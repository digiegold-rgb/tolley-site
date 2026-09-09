"use client";
import { signOut } from "next-auth/react";
export function SignOutButton() {
  return <button className="rounded-lg bg-violet-600 px-5 py-3 text-white"
    onClick={() => signOut({ callbackUrl: "/login" })}>Sign out of Tolley</button>;
}
