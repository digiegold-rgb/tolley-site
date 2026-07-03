import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UploadClient } from "./upload-client";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const metadata = {
  title: "Content Upload | Tolley",
  description: "Upload raw video footage for agent processing",
  robots: { index: false, follow: false },
};

export default async function ContentUploadPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/content/upload");
  }

  const isAdmin =
    !!session.user.email &&
    ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  if (!isAdmin) {
    redirect("/");
  }

  return <UploadClient />;
}
