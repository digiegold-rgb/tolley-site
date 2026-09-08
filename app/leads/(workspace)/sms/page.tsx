import { redirect } from "next/navigation";

export default function SmsRedirect() {
  redirect("/leads/conversations");
}
