-- Single-use password reset grants.
--
-- Only the SHA-256 hash of the emitted token is stored (same approach as
-- `Session.tokenHash`), so a database disclosure cannot be replayed as a
-- working reset link. `consumedAt` records redemption so a token cannot be
-- reused, while keeping an auditable record without retaining the raw token.
--
-- Scope note: this migration intentionally contains ONLY the new table.
-- `prisma migrate dev` also proposed unrelated `updatedAt` default drops and
-- foreign-key renames for Deal/Approval/Release/Enforcement/Moderation. That
-- is pre-existing baseline drift, unrelated to password reset, so it is not
-- bundled here.
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "requestedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
