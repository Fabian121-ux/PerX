# Deployment and Architecture 

## Overview
This document outlines the deployment strategy for PerX on Vercel.

## Vercel Deployment

1. **Variables Requirement**:
Ensure all `NEXT_PUBLIC_*` and server-only variables (like `DATABASE_URL` and `DIRECT_URL`) are loaded accurately in the Vercel Production Environment.
- `DATABASE_URL` MUST use port `6543`.
- `DIRECT_URL` MUST use port `5432`.

2. **Supabase Connectivity**:
The Prisma client resolves the database locally using pooler endpoints on AWS `aws-0-eu-north-1.pooler.supabase.com`. Ensure you run `prisma generate` before builds to properly link binaries.

3. **Migrations**:
Migrations are deployed manually from a secure ops environment via `npx prisma migrate deploy` or automatically in Vercel if configured. The current version includes `0002_open_beta_registration`.

4. **Bootstrap Admin**:
Do NOT automate `admin:bootstrap` inside CI/CD. It requires interactive, masked password entry or an active, approved email mapping for `promote_existing` mode.
