-- Add products without replacing or reordering existing opportunity types.
ALTER TYPE "OpportunityType" ADD VALUE IF NOT EXISTS 'PRODUCT';
