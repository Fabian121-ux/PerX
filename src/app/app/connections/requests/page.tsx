import { redirect } from "next/navigation";

export default function ConnectionRequestsPage() {
  redirect("/app/network?tab=requests");
}
