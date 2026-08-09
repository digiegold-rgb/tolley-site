import { redirect } from "next/navigation";

import { requireAdminPageSession } from "@/lib/admin-auth";

export default async function Studio2Page() {
  await requireAdminPageSession("/video/studio2");
  redirect("https://video.tolley.io");
}
