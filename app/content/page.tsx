import { requireAdminPageSession } from "@/lib/admin-auth";
import { ContentPortal } from "./portal-client";

export const metadata = {
  title: "Content Portal | Tolley",
  description: "Manage the content autopilot pipeline",
  robots: { index: false, follow: false },
};

export default async function ContentPage() {
  await requireAdminPageSession("/content");
  return <ContentPortal />;
}
