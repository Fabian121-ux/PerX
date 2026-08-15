import { redirect } from "next/navigation";

import {
  getLegacyPeopleDestination,
  type ConnectionSearchParam,
} from "@/features/network/routes";

export default async function LegacyPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: ConnectionSearchParam;
    location?: ConnectionSearchParam;
    q?: ConnectionSearchParam;
    role?: ConnectionSearchParam;
    skill?: ConnectionSearchParam;
  }>;
}) {
  redirect(getLegacyPeopleDestination(await searchParams));
}
