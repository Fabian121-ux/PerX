import { redirect } from "next/navigation";

import {
  getLegacyRequestsDestination,
  type ConnectionSearchParam,
} from "@/features/network/routes";

export default async function LegacyConnectionRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: ConnectionSearchParam }>;
}) {
  redirect(getLegacyRequestsDestination(await searchParams));
}
