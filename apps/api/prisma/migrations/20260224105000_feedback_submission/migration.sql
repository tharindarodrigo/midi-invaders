-- CreateTable
CREATE TABLE "FeedbackToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "issuedIpHash" TEXT,
    "issuedUserAgentHash" TEXT,

    CONSTRAINT "FeedbackToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "wave" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "inputMode" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "riskFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackToken_sessionId_key" ON "FeedbackToken"("sessionId");

-- CreateIndex
CREATE INDEX "FeedbackToken_expiresAt_idx" ON "FeedbackToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackSubmission_sessionId_key" ON "FeedbackSubmission"("sessionId");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_createdAt_idx" ON "FeedbackSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_mode_difficulty_rating_idx" ON "FeedbackSubmission"("mode", "difficulty", "rating");

-- AddForeignKey
ALTER TABLE "FeedbackToken" ADD CONSTRAINT "FeedbackToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
