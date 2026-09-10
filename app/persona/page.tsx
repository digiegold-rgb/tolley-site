import { requireAdminPageSession } from "@/lib/admin-auth";
import PersonaEditor from "./persona-editor";

export const metadata = { title: "Persona editor", robots: { index: false, follow: false } };
export default async function PersonaPage() {
  await requireAdminPageSession("/persona");
  return <PersonaEditor />;
}
