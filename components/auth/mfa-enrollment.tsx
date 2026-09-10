"use client";
import { useState } from "react";
import { MfaSetupDialog } from "./mfa-setup-dialog";
export function MfaEnrollment({ callbackUrl }: { callbackUrl: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="rounded-lg bg-violet-600 px-4 py-2 text-white" onClick={() => setOpen(true)}>Set up authenticator</button>
    {open && <MfaSetupDialog onCancel={() => setOpen(false)} onComplete={() => window.location.assign(callbackUrl)} />}</>;
}
