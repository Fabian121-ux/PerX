import { redirect } from "next/navigation";

export default function ConnectionsPage() {
  redirect("/app/network?tab=connections");
}
