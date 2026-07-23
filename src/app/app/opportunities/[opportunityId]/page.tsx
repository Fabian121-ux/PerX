import { notFound } from "next/navigation";

import { AppSection } from "@/components/app-section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function OpportunityOwnerPreviewPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const user = await requireUser();
  const { opportunityId } = await params;
  const opportunity = await getPrisma().opportunity.findFirst({
    include: { category: true },
    where: { id: opportunityId, ownerId: user.id },
  });

  if (!opportunity) notFound();

  return (
    <AppSection
      actions={
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/app/opportunities/${opportunity.id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
          <ButtonLink href="/app/manage">Manage</ButtonLink>
        </div>
      }
      description="Owner-only preview. Drafts, paused and archived items are not public discovery pages."
      title={opportunity.title}
    >
      <Card>
        <div className="flex flex-wrap gap-2">
          <Badge>{opportunity.type.replaceAll("_", " ")}</Badge>
          <Badge>{opportunity.status}</Badge>
          <Badge>{opportunity.moderationStatus}</Badge>
          {opportunity.category ? <Badge>{opportunity.category.name}</Badge> : null}
        </div>
        <p className="mt-4 text-lg font-semibold text-[color:var(--px-text)]">
          {opportunity.summary}
        </p>
        <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[color:var(--px-text-muted)]">
          {opportunity.description}
        </div>
        {opportunity.skills.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {opportunity.skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>
        ) : null}
      </Card>
    </AppSection>
  );
}
