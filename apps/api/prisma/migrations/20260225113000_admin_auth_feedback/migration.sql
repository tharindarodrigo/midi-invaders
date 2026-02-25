-- CreateTable
CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminOtpChallenge" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "requestIpHash" TEXT,
  "requestUserAgentHash" TEXT,

  CONSTRAINT "AdminOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "issuedIpHash" TEXT,
  "issuedUserAgentHash" TEXT,

  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminOtpChallenge_adminUserId_createdAt_idx" ON "AdminOtpChallenge"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminOtpChallenge_expiresAt_idx" ON "AdminOtpChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "AdminOtpChallenge" ADD CONSTRAINT "AdminOtpChallenge_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default admin user
INSERT INTO "AdminUser" ("id", "name", "email", "createdAt")
VALUES ('admin-tharinda-rodrigo', 'Tharinda Rodrigo', 'tharindarodrigo@gmail.com', CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;
