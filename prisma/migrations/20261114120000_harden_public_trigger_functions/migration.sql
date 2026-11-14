-- Harden public trigger functions without changing their trigger behavior.
-- Trigger execution does not require callers to retain direct EXECUTE grants.

CREATE OR REPLACE FUNCTION public.enforce_proposal_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Submitted proposal versions cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' AND (
    NEW."proposalId" IS DISTINCT FROM OLD."proposalId" OR
    NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR
    NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" OR
    NEW."currency" IS DISTINCT FROM OLD."currency" OR
    NEW."description" IS DISTINCT FROM OLD."description" OR
    NEW."deliveryDays" IS DISTINCT FROM OLD."deliveryDays" OR
    NEW."includedRevisions" IS DISTINCT FROM OLD."includedRevisions" OR
    NEW."createdById" IS DISTINCT FROM OLD."createdById" OR
    NEW."supersedesVersionId" IS DISTINCT FROM OLD."supersedesVersionId"
  ) THEN
    RAISE EXCEPTION 'Submitted proposal version terms are immutable.';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('SUBMITTED', 'WITHDRAWN')) OR
    (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('SUPERSEDED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'))
  ) THEN
    RAISE EXCEPTION 'Invalid proposal version status transition from % to %.', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_proposal_version_milestone_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  old_parent_status public."ProposalVersionStatus";
  new_parent_status public."ProposalVersionStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT "status" INTO old_parent_status
    FROM public."ProposalVersion"
    WHERE "id" = OLD."proposalVersionId";
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "status" INTO new_parent_status
    FROM public."ProposalVersion"
    WHERE "id" = NEW."proposalVersionId";
  END IF;

  IF (old_parent_status IS NOT NULL AND old_parent_status <> 'DRAFT') OR
     (new_parent_status IS NOT NULL AND new_parent_status <> 'DRAFT') THEN
    RAISE EXCEPTION 'Submitted proposal version milestones are immutable.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- The event trigger remains owned by postgres and continues to run on DDL.
-- Application roles must not be able to invoke its SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role;

-- Trigger functions are invoked by PostgreSQL's trigger machinery; direct
-- invocation by API roles is unnecessary and can bypass intended call paths.
REVOKE ALL ON FUNCTION public.enforce_proposal_version_immutability() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_proposal_version_milestone_immutability() FROM PUBLIC, anon, authenticated, service_role;
