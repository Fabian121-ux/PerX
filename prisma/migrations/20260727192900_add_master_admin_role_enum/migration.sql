-- Commit MASTER_ADMIN before the following migration reads the enum value.
-- PostgreSQL does not allow a newly added enum value to be used in the same transaction.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'MASTER_ADMIN';
