import { redirect } from "next/navigation";

import {
  getLegacyNetworkDestination,
  type ConnectionSearchParam,
} from "@/features/network/routes";

export default async function LegacyNetworkPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: ConnectionSearchParam;
    tab?: ConnectionSearchParam;
  }>;
}) {
  redirect(getLegacyNetworkDestination(await searchParams));
}
